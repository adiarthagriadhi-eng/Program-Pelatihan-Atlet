import { getPool } from "@/lib/db";

const REQUIRED_TYPES = ["sleep_quality", "muscle_soreness", "mood", "stress"] as const;

export type ReadinessResult =
  | {
      status: "ok";
      date: string;
      score: number;
      details: {
        sleepQuality: number;
        muscleSoreness: number;
        mood: number;
        stress: number;
      };
    }
  | { status: "no_data" };

/**
 * Readiness score = rata-rata dari sleep_quality, muscle_soreness
 * (dibalik: 6 - nilai, karena skalanya 1=tidak nyeri .. 5=sangat nyeri),
 * mood, dan stress -- diambil dari hari terakhir yang punya keempat
 * metrik itu lengkap (bukan harus hari ini).
 */
export async function calculateLatestReadiness(athleteId: number): Promise<ReadinessResult> {
  const { rows } = await getPool().query<{
    assessment_date: string;
    type: string;
    value: string;
  }>(
    `
    SELECT assessment_date, type, value
    FROM assessments
    WHERE athlete_id = $1
      AND type = ANY($2::assessment_type[])
    ORDER BY assessment_date DESC
    `,
    [athleteId, REQUIRED_TYPES]
  );

  const byDate = new Map<string, Record<string, number>>();
  for (const row of rows) {
    const entry = byDate.get(row.assessment_date) ?? {};
    entry[row.type] = Number(row.value);
    byDate.set(row.assessment_date, entry);
  }

  for (const [date, values] of byDate) {
    const hasAll = REQUIRED_TYPES.every((type) => type in values);
    if (!hasAll) continue;

    const invertedSoreness = 6 - values.muscle_soreness;
    const score = (values.sleep_quality + invertedSoreness + values.mood + values.stress) / 4;

    return {
      status: "ok",
      date,
      score,
      details: {
        sleepQuality: values.sleep_quality,
        muscleSoreness: values.muscle_soreness,
        mood: values.mood,
        stress: values.stress,
      },
    };
  }

  return { status: "no_data" };
}
