import { NextResponse } from "next/server";
import { getPool } from "@/lib/db";
import { phaseFormSchema } from "@/lib/validation/phase";

export async function POST(request: Request) {
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
    programId,
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
      `INSERT INTO training_phases
         (program_id, phase_type, week_number, start_date, end_date, primary_focus,
          planned_volume, planned_intensity, target_load_index)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING id`,
      [
        programId,
        phaseType,
        weekNumber,
        startDate,
        endDate,
        primaryFocus,
        plannedVolume,
        plannedIntensity,
        targetLoadIndex,
      ]
    );

    return NextResponse.json({ status: "ok", phase: rows[0] }, { status: 201 });
  } catch (error) {
    console.error("Gagal menyimpan fase program:", error);
    return NextResponse.json(
      { status: "error", message: "Gagal menyimpan data ke database. Coba lagi." },
      { status: 500 }
    );
  }
}
