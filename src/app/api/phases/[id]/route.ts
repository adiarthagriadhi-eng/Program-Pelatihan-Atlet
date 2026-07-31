import { NextResponse } from "next/server";
import { getPool } from "@/lib/db";
import { phaseFormSchema } from "@/lib/validation/phase";

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const phaseId = Number(id);

  if (!Number.isInteger(phaseId) || phaseId <= 0) {
    return NextResponse.json(
      { status: "error", message: "ID fase tidak valid." },
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

  const parsed = phaseFormSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { status: "error", errors: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  const {
    phaseType,
    weekNumber,
    startDate,
    endDate,
    primaryFocus,
    plannedVolume,
    plannedIntensity,
    targetLoadIndex,
  } = parsed.data;

  try {
    const { rows } = await getPool().query<{ id: number }>(
      `UPDATE training_phases
       SET phase_type = $1, week_number = $2, start_date = $3, end_date = $4,
           primary_focus = $5, planned_volume = $6, planned_intensity = $7,
           target_load_index = $8
       WHERE id = $9
       RETURNING id`,
      [
        phaseType,
        weekNumber,
        startDate,
        endDate,
        primaryFocus,
        plannedVolume,
        plannedIntensity,
        targetLoadIndex,
        phaseId,
      ]
    );

    if (rows.length === 0) {
      return NextResponse.json(
        { status: "error", message: "Fase tidak ditemukan." },
        { status: 404 }
      );
    }

    return NextResponse.json({ status: "ok", phase: rows[0] });
  } catch (error) {
    console.error("Gagal memperbarui fase program:", error);
    return NextResponse.json(
      { status: "error", message: "Gagal menyimpan data ke database. Coba lagi." },
      { status: 500 }
    );
  }
}
