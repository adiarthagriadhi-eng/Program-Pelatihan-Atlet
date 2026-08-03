import { NextResponse } from "next/server";
import { getPool } from "@/lib/db";
import { trainingGuidelineEditSchema } from "@/lib/validation/training-guideline";

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const guidelineId = Number(id);

  if (!Number.isInteger(guidelineId) || guidelineId <= 0) {
    return NextResponse.json(
      { status: "error", message: "ID kaidah tidak valid." },
      { status: 400 }
    );
  }

  const body = await request.json().catch(() => null);

  if (!body) {
    return NextResponse.json(
      { status: "error", message: "Data yang dikirim tidak valid." },
      { status: 400 }
    );
  }

  const parsed = trainingGuidelineEditSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { status: "error", errors: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  const { applicablePhaseType, topic, guidelineText } = parsed.data;

  try {
    const { rows } = await getPool().query<{ id: number }>(
      `UPDATE training_guidelines
       SET applicable_phase_type = $1, topic = $2, guideline_text = $3
       WHERE id = $4
       RETURNING id`,
      [applicablePhaseType, topic, guidelineText, guidelineId]
    );

    if (rows.length === 0) {
      return NextResponse.json(
        { status: "error", message: "Kaidah tidak ditemukan." },
        { status: 404 }
      );
    }

    return NextResponse.json({ status: "ok" });
  } catch (error) {
    console.error("Gagal memperbarui kaidah pelatihan:", error);
    return NextResponse.json(
      { status: "error", message: "Gagal menyimpan perubahan. Coba lagi." },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const guidelineId = Number(id);

  if (!Number.isInteger(guidelineId) || guidelineId <= 0) {
    return NextResponse.json(
      { status: "error", message: "ID kaidah tidak valid." },
      { status: 400 }
    );
  }

  try {
    const { rows } = await getPool().query<{ id: number }>(
      `DELETE FROM training_guidelines WHERE id = $1 RETURNING id`,
      [guidelineId]
    );

    if (rows.length === 0) {
      return NextResponse.json(
        { status: "error", message: "Kaidah tidak ditemukan." },
        { status: 404 }
      );
    }

    return NextResponse.json({ status: "ok" });
  } catch (error) {
    console.error("Gagal menghapus kaidah pelatihan:", error);
    return NextResponse.json(
      { status: "error", message: "Gagal menghapus data. Coba lagi." },
      { status: 500 }
    );
  }
}
