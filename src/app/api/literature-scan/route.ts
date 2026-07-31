import { NextResponse } from "next/server";
import { getPool } from "@/lib/db";
import { scanLiterature } from "@/lib/literature-scanner";
import { literatureScanRequestSchema } from "@/lib/validation/literature-scan";

const DEFAULT_CONTEXT = "Tidak ada konteks program spesifik.";

// Web search + reasoning bisa makan waktu puluhan detik; perpanjang batas
// waktu function di Vercel (default 10 detik terlalu singkat untuk ini).
export const maxDuration = 60;

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

    const client = await getPool().connect();
    try {
      await client.query("BEGIN");
      for (const finding of findings) {
        await client.query(
          `INSERT INTO literature_findings
             (topic_tag, source_title, source_url, summary, relevance_score, caution_note)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [
            topicTag,
            finding.source_title,
            finding.source_url,
            finding.summary,
            finding.relevance_score,
            finding.caution_note,
          ]
        );
      }
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }

    return NextResponse.json(
      { status: "ok", count: findings.length, findings },
      { status: 201 }
    );
  } catch (error) {
    console.error("Gagal menjalankan literature scan:", error);
    return NextResponse.json(
      { status: "error", message: "Gagal menjalankan pemindaian literatur. Coba lagi." },
      { status: 500 }
    );
  }
}
