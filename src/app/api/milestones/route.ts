import { NextResponse } from "next/server";
import { getPool } from "@/lib/db";
import { milestoneFormSchema } from "@/lib/validation/milestone";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);

  if (!body) {
    return NextResponse.json(
      { status: "error", message: "Data yang dikirim tidak valid." },
      { status: 400 }
    );
  }

  const parsed = milestoneFormSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { status: "error", errors: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  const { athleteId, targetDate, milestoneType, description } = parsed.data;

  try {
    const { rows } = await getPool().query<{ id: number }>(
      `INSERT INTO milestones (athlete_id, target_date, milestone_type, description)
       VALUES ($1, $2, $3, $4)
       RETURNING id`,
      [athleteId, targetDate, milestoneType, description]
    );

    return NextResponse.json({ status: "ok", milestone: rows[0] }, { status: 201 });
  } catch (error) {
    console.error("Gagal menyimpan milestone:", error);
    return NextResponse.json(
      { status: "error", message: "Gagal menyimpan data ke database. Coba lagi." },
      { status: 500 }
    );
  }
}
