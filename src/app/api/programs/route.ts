import { NextResponse } from "next/server";
import { getPool } from "@/lib/db";
import { programFormSchema } from "@/lib/validation/program";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);

  if (!body) {
    return NextResponse.json(
      { status: "error", message: "Data yang dikirim tidak valid." },
      { status: 400 }
    );
  }

  const parsed = programFormSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { status: "error", errors: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  const { athleteId, startDate, endDate, macrocycleGoal } = parsed.data;

  try {
    const { rows: athleteRows } = await getPool().query<{ sport_id: number }>(
      "SELECT sport_id FROM athletes WHERE id = $1",
      [athleteId]
    );

    if (athleteRows.length === 0) {
      return NextResponse.json(
        { status: "error", message: "Atlet tidak ditemukan." },
        { status: 404 }
      );
    }

    const { rows } = await getPool().query<{ id: number }>(
      `INSERT INTO training_programs (athlete_id, sport_id, start_date, end_date, macrocycle_goal)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id`,
      [athleteId, athleteRows[0].sport_id, startDate, endDate ?? null, macrocycleGoal]
    );

    return NextResponse.json({ status: "ok", program: rows[0] }, { status: 201 });
  } catch (error) {
    console.error("Gagal menyimpan program:", error);
    return NextResponse.json(
      { status: "error", message: "Gagal menyimpan data ke database. Coba lagi." },
      { status: 500 }
    );
  }
}
