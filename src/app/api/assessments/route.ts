import { NextResponse } from "next/server";
import { getPool } from "@/lib/db";
import { dailyAssessmentSchema } from "@/lib/validation/assessment";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);

  if (!body) {
    return NextResponse.json(
      { status: "error", message: "Data yang dikirim tidak valid." },
      { status: 400 }
    );
  }

  const parsed = dailyAssessmentSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { status: "error", errors: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  const {
    athleteId,
    assessmentDate,
    sessionRpe,
    sessionDurationMinutes,
    sleepHours,
    wellnessScore,
  } = parsed.data;

  const entries: Array<{ type: string; value: number; unit: string }> = [
    { type: "session_rpe", value: sessionRpe, unit: "skala 1-10" },
    { type: "session_duration", value: sessionDurationMinutes, unit: "menit" },
    { type: "sleep_hours", value: sleepHours, unit: "jam" },
    { type: "wellness_score", value: wellnessScore, unit: "skala 1-5" },
  ];

  const client = await getPool().connect();

  try {
    await client.query("BEGIN");
    for (const entry of entries) {
      await client.query(
        `INSERT INTO assessments (athlete_id, assessment_date, type, value, unit)
         VALUES ($1, $2, $3, $4, $5)`,
        [athleteId, assessmentDate, entry.type, entry.value, entry.unit]
      );
    }
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Gagal menyimpan assessment:", error);
    return NextResponse.json(
      { status: "error", message: "Gagal menyimpan data ke database. Coba lagi." },
      { status: 500 }
    );
  } finally {
    client.release();
  }

  return NextResponse.json({ status: "ok" }, { status: 201 });
}
