import { NextResponse } from "next/server";
import { getPool } from "@/lib/db";
import {
  assessGuideline,
  fetchApplicableGuidelines,
  getSportKnowledgeStatus,
  resolveActiveProgramPhase,
} from "@/lib/revision-engine";

// Menilai beberapa kaidah lewat Claude API bisa makan waktu; perpanjang
// batas waktu function di Vercel (default 10 detik terlalu singkat).
export const maxDuration = 60;

const UNDER_CONSTRUCTION_MESSAGE =
  "Program pada cabor ini masih under construction -- belum ada basis pengetahuan terverifikasi";

/**
 * Dipicu coach secara eksplisit dari Editor Program ("Minta Revisi").
 * Mengganti seluruh alur Literature Scanner real-time sebelumnya --
 * TIDAK PERNAH mencari di web; hanya membandingkan training_guidelines
 * yang sudah diverifikasi manual terhadap parameter fase aktif program.
 * TIDAK PERNAH menerapkan apapun ke training_sessions -- hanya membuat
 * draft revision_log berstatus pending_review yang menunggu keputusan
 * Approve/Reject/Edit pelatih di halaman Review Revisi.
 */
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const programId = Number(id);

  if (!Number.isInteger(programId) || programId <= 0) {
    return NextResponse.json(
      { status: "error", message: "ID program tidak valid." },
      { status: 400 }
    );
  }

  try {
    const phase = await resolveActiveProgramPhase(programId);

    if (!phase) {
      return NextResponse.json({
        status: "ok",
        ready: false,
        draftedCount: 0,
        message:
          "Program ini belum punya fase aktif -- pastikan atlet diarahkan ke salah satu fase program ini (lewat Profil Atlet) sebelum meminta revisi.",
      });
    }

    const knowledgeStatus = await getSportKnowledgeStatus(phase.sportId);

    if (knowledgeStatus === "under_construction") {
      return NextResponse.json({
        status: "ok",
        ready: false,
        draftedCount: 0,
        message: UNDER_CONSTRUCTION_MESSAGE,
      });
    }

    const guidelines = await fetchApplicableGuidelines(phase.sportId, phase.phaseType);

    if (guidelines.length === 0) {
      return NextResponse.json({
        status: "ok",
        ready: true,
        draftedCount: 0,
        message: "Tidak ada kaidah pelatihan yang berlaku untuk fase ini.",
      });
    }

    const assessments = await Promise.allSettled(
      guidelines.map(async (guideline) => ({
        guideline,
        assessment: await assessGuideline(guideline, phase),
      }))
    );

    let draftedCount = 0;
    let failedCount = 0;

    for (const result of assessments) {
      if (result.status === "rejected") {
        console.error("Gagal menilai kaidah pelatihan:", result.reason);
        failedCount += 1;
        continue;
      }

      const { guideline, assessment } = result.value;
      if (!assessment.needs_adjustment) continue;

      try {
        await getPool().query(
          `INSERT INTO revision_log
             (program_id, triggered_by, trigger_summary, proposed_changes, source_citations, status)
           VALUES ($1, 'manual_coach', $2, $3, $4, 'pending_review')`,
          [
            programId,
            `Diminta pelatih -- kaidah dari sumber "${guideline.source_title}"${
              guideline.topic ? ` (topik: ${guideline.topic})` : ""
            }`,
            JSON.stringify({
              phase_id: phase.phaseId,
              volume_delta_percent: assessment.volume_delta_percent,
              intensity_delta_percent: assessment.intensity_delta_percent,
              session_type_swap: assessment.session_type_swap,
              rationale: assessment.rationale,
            }),
            JSON.stringify([
              {
                guideline_id: guideline.id,
                url: guideline.source_url,
                note: guideline.guideline_text,
              },
            ]),
          ]
        );
        draftedCount += 1;
      } catch (error) {
        console.error("Gagal menyimpan draft revisi dari kaidah pelatihan:", error);
      }
    }

    if (failedCount === guidelines.length) {
      return NextResponse.json(
        {
          status: "error",
          message: "Gagal menilai kaidah pelatihan (masalah teknis). Coba lagi.",
        },
        { status: 500 }
      );
    }

    const partialFailureNote =
      failedCount > 0 ? ` (${failedCount} kaidah gagal dinilai karena masalah teknis -- coba lagi nanti.)` : "";

    return NextResponse.json({
      status: "ok",
      ready: true,
      draftedCount,
      message:
        (draftedCount > 0
          ? `${draftedCount} draft revisi dibuat -- tinjau di halaman Review Revisi.`
          : "Tidak ada penyesuaian yang direkomendasikan saat ini -- parameter program sudah sesuai kaidah yang ada.") +
        partialFailureNote,
    });
  } catch (error) {
    console.error("Gagal memproses permintaan revisi:", error);
    const message =
      error instanceof Error && error.message
        ? error.message
        : "Gagal memproses permintaan revisi. Coba lagi.";
    return NextResponse.json({ status: "error", message }, { status: 500 });
  }
}
