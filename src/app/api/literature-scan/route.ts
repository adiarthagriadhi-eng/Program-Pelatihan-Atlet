import { NextResponse } from "next/server";
import { getPool } from "@/lib/db";
import { scanLiterature, type LiteratureFinding } from "@/lib/literature-scanner";
import {
  draftProposedChange,
  RELEVANCE_AUTO_DRAFT_THRESHOLD,
  type PhaseContext,
} from "@/lib/revision-drafter";
import { literatureScanRequestSchema } from "@/lib/validation/literature-scan";
import type { PhaseType } from "@/lib/constants/phase";

const DEFAULT_CONTEXT = "Tidak ada konteks program spesifik.";

// Web search + reasoning bisa makan waktu puluhan detik; perpanjang batas
// waktu function di Vercel (default 10 detik terlalu singkat untuk ini).
export const maxDuration = 60;

type CurrentPhaseRow = {
  phase_id: number;
  program_id: number;
  phase_type: PhaseType;
  primary_focus: string | null;
  planned_volume: string | null;
  planned_intensity: string | null;
  target_load_index: string | null;
};

/**
 * Menerjemahkan temuan literatur (relevance_score di atas ambang) menjadi
 * draft di revision_log berstatus pending_review, terikat ke program aktif
 * atlet (via fase saat ini). Best-effort: kegagalan di sini TIDAK boleh
 * menggagalkan penyimpanan temuan literatur itu sendiri, dan TIDAK PERNAH
 * mengubah apapun di training_sessions -- itu hanya terjadi saat pelatih
 * menekan Approve di halaman Review Revisi.
 */
async function draftPendingRevisions(
  findings: Array<LiteratureFinding & { id: number }>,
  phase: CurrentPhaseRow
): Promise<number> {
  const qualifying = findings.filter(
    (f) => (f.relevance_score ?? 0) > RELEVANCE_AUTO_DRAFT_THRESHOLD
  );

  if (qualifying.length === 0) return 0;

  const phaseContext: PhaseContext = {
    phaseType: phase.phase_type,
    primaryFocus: phase.primary_focus,
    plannedVolume: phase.planned_volume != null ? Number(phase.planned_volume) : null,
    plannedIntensity:
      phase.planned_intensity != null ? Number(phase.planned_intensity) : null,
    targetLoadIndex:
      phase.target_load_index != null ? Number(phase.target_load_index) : null,
  };

  const drafts = await Promise.allSettled(
    qualifying.map(async (finding) => {
      const proposedChanges = await draftProposedChange(finding, phaseContext);
      return { finding, proposedChanges };
    })
  );

  let createdCount = 0;

  for (const result of drafts) {
    if (result.status === "rejected") {
      console.error("Gagal membuat draft revisi otomatis:", result.reason);
      continue;
    }

    const { finding, proposedChanges } = result.value;

    try {
      const { rows } = await getPool().query<{ id: number }>(
        `INSERT INTO revision_log
           (program_id, triggered_by, trigger_summary, proposed_changes, source_citations, status)
         VALUES ($1, 'auto_literature', $2, $3, $4, 'pending_review')
         RETURNING id`,
        [
          phase.program_id,
          `Temuan literatur relevan (skor ${finding.relevance_score?.toFixed(2)}): ${finding.source_title}`,
          JSON.stringify({ ...proposedChanges, phase_id: phase.phase_id }),
          JSON.stringify([
            { finding_id: finding.id, url: finding.source_url, note: finding.summary },
          ]),
        ]
      );

      await getPool().query(
        `INSERT INTO revision_literature_link (revision_id, finding_id) VALUES ($1, $2)`,
        [rows[0].id, finding.id]
      );

      createdCount += 1;
    } catch (error) {
      console.error("Gagal menyimpan draft revisi otomatis:", error);
    }
  }

  return createdCount;
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);

  if (!body) {
    return NextResponse.json(
      { status: "error", message: "Data yang dikirim tidak valid." },
      { status: 400 }
    );
  }

  const parsed = literatureScanRequestSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { status: "error", errors: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  const { topicTag, athleteId } = parsed.data;
  let programContext = parsed.data.programContext;

  try {
    if (!programContext && athleteId) {
      const { rows } = await getPool().query<{
        sport_name: string;
        phase_type: string | null;
      }>(
        `
        SELECT s.name AS sport_name, tp.phase_type
        FROM athletes a
        JOIN sports s ON a.sport_id = s.id
        LEFT JOIN training_phases tp ON a.current_phase_id = tp.id
        WHERE a.id = $1
        `,
        [athleteId]
      );
      const athlete = rows[0];
      programContext = athlete
        ? `Cabang olahraga: ${athlete.sport_name}. Fase periodisasi saat ini: ${
            athlete.phase_type ?? "belum ditentukan"
          }.`
        : DEFAULT_CONTEXT;
    }

    const findings = await scanLiterature(topicTag, programContext ?? DEFAULT_CONTEXT);

    const findingsWithId: Array<LiteratureFinding & { id: number }> = [];

    const client = await getPool().connect();
    try {
      await client.query("BEGIN");
      for (const finding of findings) {
        const { rows } = await client.query<{ id: number }>(
          `INSERT INTO literature_findings
             (topic_tag, source_title, source_url, summary, relevance_score)
           VALUES ($1, $2, $3, $4, $5)
           RETURNING id`,
          [
            topicTag,
            finding.source_title,
            finding.source_url,
            finding.summary,
            finding.relevance_score,
          ]
        );
        findingsWithId.push({ ...finding, id: rows[0].id });
      }
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }

    let draftedRevisionCount = 0;

    if (athleteId) {
      try {
        const { rows: phaseRows } = await getPool().query<CurrentPhaseRow>(
          `
          SELECT tp.id AS phase_id, tp.program_id, tp.phase_type, tp.primary_focus,
                 tp.planned_volume, tp.planned_intensity, tp.target_load_index
          FROM athletes a
          JOIN training_phases tp ON a.current_phase_id = tp.id
          WHERE a.id = $1
          `,
          [athleteId]
        );

        if (phaseRows[0]) {
          draftedRevisionCount = await draftPendingRevisions(findingsWithId, phaseRows[0]);
        }
      } catch (error) {
        console.error("Gagal memeriksa fase aktif untuk draft revisi otomatis:", error);
      }
    }

    return NextResponse.json(
      {
        status: "ok",
        count: findings.length,
        findings,
        draftedRevisionCount,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Gagal menjalankan literature scan:", error);
    const message =
      error instanceof Error && error.message
        ? error.message
        : "Gagal menjalankan pemindaian literatur. Coba lagi.";
    return NextResponse.json({ status: "error", message }, { status: 500 });
  }
}
