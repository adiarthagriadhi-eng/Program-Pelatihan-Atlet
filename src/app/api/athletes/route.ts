import { NextResponse } from "next/server";
import { getPool } from "@/lib/db";
import { athleteFormSchema } from "@/lib/validation/athlete";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);

  if (!body) {
    return NextResponse.json(
      { status: "error", message: "Data yang dikirim tidak valid." },
      { status: 400 }
    );
  }

  const parsed = athleteFormSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { status: "error", errors: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  const {
    name,
    sportId,
    birthDate,
    sex,
    trainingAgeYears,
    weightKg,
    heightCm,
    bodyFatPercent,
    disciplineCategory,
    eventName,
  } = parsed.data;

  try {
    const { rows } = await getPool().query<{ id: number; name: string }>(
      `INSERT INTO athletes
         (name, sport_id, birth_date, sex, training_age_years,
          weight_kg, height_cm, body_fat_percent, discipline_category, event_name)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING id, name`,
      [
        name,
        sportId,
        birthDate,
        sex,
        trainingAgeYears,
        weightKg,
        heightCm,
        bodyFatPercent,
        disciplineCategory,
        eventName,
      ]
    );

    return NextResponse.json({ status: "ok", athlete: rows[0] }, { status: 201 });
  } catch (error) {
    console.error("Gagal menyimpan atlet:", error);
    return NextResponse.json(
      { status: "error", message: "Gagal menyimpan data ke database. Coba lagi." },
      { status: 500 }
    );
  }
}
