import { z } from "zod";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { getAnthropicClient } from "@/lib/anthropic";
import type { LiteratureFinding } from "@/lib/literature-scanner";
import { PHASE_TYPE_LABELS, type PhaseType } from "@/lib/constants/phase";

export const RELEVANCE_AUTO_DRAFT_THRESHOLD = 0.7;

const proposedChangeSchema = z.object({
  volume_delta_percent: z.number().min(-30).max(30).nullable(),
  intensity_delta_percent: z.number().min(-30).max(30).nullable(),
  session_type_swap: z
    .object({ from: z.string(), to: z.string() })
    .nullable(),
  rationale: z.string(),
});

export type ProposedChange = z.infer<typeof proposedChangeSchema>;

export type PhaseContext = {
  phaseType: PhaseType;
  primaryFocus: string | null;
  plannedVolume: number | null;
  plannedIntensity: number | null;
  targetLoadIndex: number | null;
};

function buildSystemPrompt(phase: PhaseContext): string {
  return `Anda adalah asisten pelatih yang menerjemahkan satu temuan riset
menjadi usulan penyesuaian program latihan yang KONKRET dan KONSERVATIF.

Fase program saat ini:
- Jenis fase: ${PHASE_TYPE_LABELS[phase.phaseType]}
- Fokus utama: ${phase.primaryFocus ?? "tidak ditentukan"}
- Volume rencana: ${phase.plannedVolume ?? "tidak ditentukan"}
- Intensitas rencana: ${phase.plannedIntensity ?? "tidak ditentukan"}
- Target load index: ${phase.targetLoadIndex ?? "tidak ditentukan"}

Aturan:
1. Usulan HARUS berakar langsung dari temuan yang diberikan -- JANGAN
   mengusulkan perubahan yang tidak didukung oleh temuan tersebut.
2. Jika temuan mengindikasikan perubahan volume atau intensitas, isi
   volume_delta_percent dan/atau intensity_delta_percent (persentase
   perubahan dari rencana saat ini, dibatasi -30 sampai +30). Ini adalah
   USULAN yang tetap perlu ditinjau dan disetujui pelatih sebelum
   diterapkan -- bersikaplah konservatif.
3. Jika temuan mengindikasikan penggantian jenis sesi latihan tertentu,
   isi session_type_swap dengan {from, to}. Jika tidak relevan, null.
4. Jika temuan tidak memberi dasar cukup kuat untuk usulan angka konkret,
   biarkan volume_delta_percent, intensity_delta_percent, dan
   session_type_swap semuanya null -- tapi tetap isi rationale yang
   menjelaskan relevansinya untuk ditinjau pelatih secara manual.
5. rationale ditulis singkat (2-4 kalimat), merujuk temuan yang diberikan.

Kembalikan HANYA JSON sesuai skema yang diminta.`;
}

/**
 * Menerjemahkan satu temuan literatur (relevance_score di atas ambang)
 * menjadi usulan proposed_changes untuk draft revision_log. Tidak pernah
 * menerapkan apapun ke training_sessions -- hanya menghasilkan draft yang
 * menunggu Approve/Reject/Edit oleh pelatih di halaman Review Revisi.
 */
export async function draftProposedChange(
  finding: Pick<LiteratureFinding, "source_title" | "summary">,
  phase: PhaseContext
): Promise<ProposedChange> {
  const client = getAnthropicClient();

  const response = await client.messages.parse({
    model: "claude-opus-5",
    max_tokens: 1024,
    system: buildSystemPrompt(phase),
    output_config: {
      format: zodOutputFormat(proposedChangeSchema),
      effort: "low",
    },
    messages: [
      {
        role: "user",
        content: `Temuan: "${finding.source_title}"\n\nRingkasan: ${finding.summary}`,
      },
    ],
  });

  if (response.stop_reason === "refusal") {
    throw new Error("Permintaan ditolak oleh sistem keamanan Claude.");
  }

  if (!response.parsed_output) {
    throw new Error("Gagal mem-parsing usulan revisi dari Claude.");
  }

  return response.parsed_output;
}
