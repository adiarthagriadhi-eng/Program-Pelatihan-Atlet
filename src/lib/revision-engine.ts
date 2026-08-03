import { z } from "zod";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { getAnthropicClient } from "@/lib/anthropic";
import { getPool } from "@/lib/db";
import { PHASE_TYPE_LABELS, type PhaseType } from "@/lib/constants/phase";

export type ProgramPhaseContext = {
  programId: number;
  sportId: number;
  sportName: string;
  phaseId: number;
  phaseType: PhaseType;
  primaryFocus: string | null;
  plannedVolume: number | null;
  plannedIntensity: number | null;
  targetLoadIndex: number | null;
};

type ApplicableGuideline = {
  id: number;
  topic: string | null;
  guideline_text: string;
  source_title: string;
  source_url: string | null;
};

const assessmentSchema = z.object({
  needs_adjustment: z.boolean(),
  volume_delta_percent: z.number().min(-30).max(30).nullable(),
  intensity_delta_percent: z.number().min(-30).max(30).nullable(),
  session_type_swap: z.object({ from: z.string(), to: z.string() }).nullable(),
  rationale: z.string(),
});

export type GuidelineAssessment = z.infer<typeof assessmentSchema>;

/**
 * Cari fase aktif suatu program -- yaitu fase yang ditunjuk oleh
 * athletes.current_phase_id, DAN fase itu memang bagian dari program ini.
 * Kalau atlet belum diarahkan ke fase manapun di program ini (mis. baru
 * dibuat, atau current_phase_id menunjuk ke program lain), return null.
 */
export async function resolveActiveProgramPhase(
  programId: number
): Promise<ProgramPhaseContext | null> {
  const { rows } = await getPool().query<{
    program_id: number;
    sport_id: number;
    sport_name: string;
    phase_id: number | null;
    phase_type: PhaseType | null;
    primary_focus: string | null;
    planned_volume: string | null;
    planned_intensity: string | null;
    target_load_index: string | null;
  }>(
    `
    SELECT
      p.id AS program_id, p.sport_id, s.name AS sport_name,
      tp.id AS phase_id, tp.phase_type, tp.primary_focus,
      tp.planned_volume, tp.planned_intensity, tp.target_load_index
    FROM training_programs p
    JOIN athletes a ON a.id = p.athlete_id
    JOIN sports s ON s.id = p.sport_id
    LEFT JOIN training_phases tp ON tp.id = a.current_phase_id AND tp.program_id = p.id
    WHERE p.id = $1
    `,
    [programId]
  );

  const row = rows[0];
  if (!row || row.phase_id == null || row.phase_type == null) {
    return null;
  }

  return {
    programId: row.program_id,
    sportId: row.sport_id,
    sportName: row.sport_name,
    phaseId: row.phase_id,
    phaseType: row.phase_type,
    primaryFocus: row.primary_focus,
    plannedVolume: row.planned_volume != null ? Number(row.planned_volume) : null,
    plannedIntensity: row.planned_intensity != null ? Number(row.planned_intensity) : null,
    targetLoadIndex: row.target_load_index != null ? Number(row.target_load_index) : null,
  };
}

export async function getSportKnowledgeStatus(
  sportId: number
): Promise<"ready" | "under_construction"> {
  const { rows } = await getPool().query<{ knowledge_status: "ready" | "under_construction" }>(
    `SELECT knowledge_status FROM sports WHERE id = $1`,
    [sportId]
  );
  return rows[0]?.knowledge_status ?? "under_construction";
}

/**
 * Kaidah pelatihan yang berlaku untuk fase ini -- yang applicable_phase_type
 * sama persis dengan fase aktif, ATAU applicable_phase_type NULL (berlaku
 * semua fase). Selalu lewat JOIN ke knowledge_sources -- training_guidelines
 * hanya bisa dibuat dari sumber yang verified=true (ditegakkan saat
 * pembuatan), jadi tidak perlu filter verified terpisah di sini.
 */
export async function fetchApplicableGuidelines(
  sportId: number,
  phaseType: PhaseType
): Promise<ApplicableGuideline[]> {
  const { rows } = await getPool().query<ApplicableGuideline>(
    `
    SELECT tg.id, tg.topic, tg.guideline_text, ks.title AS source_title, ks.source_url
    FROM training_guidelines tg
    JOIN knowledge_sources ks ON ks.id = tg.source_id
    WHERE tg.sport_id = $1 AND (tg.applicable_phase_type = $2 OR tg.applicable_phase_type IS NULL)
    ORDER BY tg.created_at
    `,
    [sportId, phaseType]
  );
  return rows;
}

function buildSystemPrompt(phase: ProgramPhaseContext): string {
  return `Anda adalah asisten pelatih yang menilai apakah SATU kaidah
pelatihan terverifikasi menunjukkan perlunya penyesuaian pada program
latihan yang sedang berjalan.

Fase program saat ini:
- Cabang olahraga: ${phase.sportName}
- Jenis fase: ${PHASE_TYPE_LABELS[phase.phaseType]}
- Fokus utama: ${phase.primaryFocus ?? "tidak ditentukan"}
- Volume rencana: ${phase.plannedVolume ?? "tidak ditentukan"}
- Intensitas rencana: ${phase.plannedIntensity ?? "tidak ditentukan"}
- Target load index: ${phase.targetLoadIndex ?? "tidak ditentukan"}

Aturan:
1. Bandingkan parameter program saat ini dengan kaidah yang diberikan.
   Kalau parameter saat ini SUDAH SESUAI kaidah, set needs_adjustment
   false, semua delta null, dan isi rationale singkat menjelaskan bahwa
   kondisi saat ini sudah sesuai.
2. Kalau kaidah menunjukkan perlu penyesuaian, set needs_adjustment true
   dan isi volume_delta_percent dan/atau intensity_delta_percent
   (persentase perubahan dari rencana saat ini, dibatasi -30 sampai +30)
   dan/atau session_type_swap {from, to}. Ini adalah USULAN yang tetap
   perlu ditinjau & disetujui pelatih sebelum diterapkan -- bersikaplah
   konservatif.
3. Usulan HARUS berakar langsung dari kaidah yang diberikan -- JANGAN
   mengusulkan perubahan yang tidak didukung oleh kaidah tersebut.
4. Kalau kaidah ini tidak relevan sama sekali dengan parameter yang ada
   (mis. topiknya tidak berkaitan), set needs_adjustment false.
5. rationale ditulis singkat (2-4 kalimat), merujuk kaidah yang diberikan.

Kembalikan HANYA JSON sesuai skema yang diminta.`;
}

/**
 * Menilai satu kaidah pelatihan terhadap parameter fase program saat ini.
 * Tidak pernah menerapkan apapun ke training_sessions -- hanya
 * menghasilkan usulan yang menunggu keputusan create-draft di pemanggil.
 */
export async function assessGuideline(
  guideline: Pick<ApplicableGuideline, "guideline_text">,
  phase: ProgramPhaseContext
): Promise<GuidelineAssessment> {
  const client = getAnthropicClient();

  const response = await client.messages.parse({
    model: "claude-opus-5",
    max_tokens: 1024,
    system: buildSystemPrompt(phase),
    output_config: {
      format: zodOutputFormat(assessmentSchema),
      effort: "low",
    },
    messages: [
      {
        role: "user",
        content: `Kaidah pelatihan: ${guideline.guideline_text}`,
      },
    ],
  });

  if (response.stop_reason === "refusal") {
    throw new Error("Permintaan ditolak oleh sistem keamanan Claude.");
  }

  if (!response.parsed_output) {
    throw new Error("Gagal mem-parsing penilaian kaidah dari Claude.");
  }

  return response.parsed_output;
}
