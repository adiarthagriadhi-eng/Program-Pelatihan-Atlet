import { NextResponse } from "next/server";
import { getPool } from "@/lib/db";
import { trainingGuidelineFormSchema } from "@/lib/validation/training-guideline";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);

  if (!body) {
    return NextResponse.json(
      { status: "error", message: "Data yang dikirim tidak valid." },
      { status: 400 }
    );
  }

  const parsed = trainingGuidelineFormSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { status: "error", errors: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  const { sportId, sourceId, applicablePhaseType, topic, guidelineText } = parsed.data;

  try {
    // Pertahanan tambahan di server -- UI hanya menawarkan sumber yang
    // verified=true & satu cabor, tapi jangan percaya begitu saja apa
    // yang dikirim client.
    const { rows: sourceRows } = await getPool().query<{ verified: boolean }>(
      `SELECT verified FROM knowledge_sources WHERE id = $1 AND sport_id = $2`,
      [sourceId, sportId]
    );

    if (sourceRows.length === 0) {
      return NextResponse.json(
        { status: "error", message: "Sumber tidak ditemukan untuk cabang olahraga ini." },
        { status: 404 }
      );
    }

    if (!sourceRows[0].verified) {
      return NextResponse.json(
        {
          status: "error",
          message: "Sumber ini belum diverifikasi -- verifikasi dulu sebelum dipakai sebagai dasar kaidah.",
        },
        { status: 409 }
      );
    }

    const { rows } = await getPool().query<{ id: number }>(
      `INSERT INTO training_guidelines (sport_id, source_id, applicable_phase_type, topic, guideline_text)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id`,
      [sportId, sourceId, applicablePhaseType, topic, guidelineText]
    );

    return NextResponse.json({ status: "ok", guideline: rows[0] }, { status: 201 });
  } catch (error) {
    console.error("Gagal menyimpan kaidah pelatihan:", error);
    return NextResponse.json(
      { status: "error", message: "Gagal menyimpan data ke database. Coba lagi." },
      { status: 500 }
    );
  }
}
