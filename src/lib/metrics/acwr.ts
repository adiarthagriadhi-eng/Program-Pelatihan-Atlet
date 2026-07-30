import { getPool } from "@/lib/db";

const ACUTE_WINDOW_DAYS = 7;
const CHRONIC_WINDOW_DAYS = 28;
// ACWR dari 1-2 hari data saja tidak bermakna secara statistik.
const MIN_CHRONIC_DAYS_WITH_DATA = 3;

export type AcwrZone = "aman" | "perhatian" | "risiko_tinggi";

export type AcwrResult =
  | {
      status: "ok";
      acuteLoad: number;
      chronicLoad: number;
      acwr: number;
      zone: AcwrZone;
    }
  | { status: "insufficient_data" };

function average(values: number[]): number {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function zoneFor(acwr: number): AcwrZone {
  if (acwr > 1.5) return "risiko_tinggi";
  if (acwr >= 0.8 && acwr <= 1.3) return "aman";
  return "perhatian";
}

/**
 * ACWR = rata-rata beban sesi (RPE x durasi menit) 7 hari terakhir dibagi
 * rata-rata beban sesi 28 hari terakhir. Beban sesi diambil dari tabel
 * `assessments` (type session_rpe & session_duration), bukan dari
 * training_sessions -- karena itulah tempat data ini masuk lewat halaman
 * "Input Assessment Harian".
 */
export async function calculateAcwr(athleteId: number): Promise<AcwrResult> {
  const { rows } = await getPool().query<{
    date: string;
    rpe: string;
    duration: string;
  }>(
    `
    WITH rpe_daily AS (
      SELECT assessment_date, AVG(value) AS rpe
      FROM assessments
      WHERE athlete_id = $1
        AND type = 'session_rpe'
        AND assessment_date >= CURRENT_DATE - ($2 * INTERVAL '1 day')
        AND assessment_date <= CURRENT_DATE
      GROUP BY assessment_date
    ),
    duration_daily AS (
      SELECT assessment_date, AVG(value) AS duration
      FROM assessments
      WHERE athlete_id = $1
        AND type = 'session_duration'
        AND assessment_date >= CURRENT_DATE - ($2 * INTERVAL '1 day')
        AND assessment_date <= CURRENT_DATE
      GROUP BY assessment_date
    )
    SELECT r.assessment_date AS date, r.rpe, d.duration
    FROM rpe_daily r
    JOIN duration_daily d ON d.assessment_date = r.assessment_date
    ORDER BY r.assessment_date
    `,
    [athleteId, CHRONIC_WINDOW_DAYS - 1]
  );

  if (rows.length < MIN_CHRONIC_DAYS_WITH_DATA) {
    return { status: "insufficient_data" };
  }

  const acuteCutoff = new Date();
  acuteCutoff.setHours(0, 0, 0, 0);
  acuteCutoff.setDate(acuteCutoff.getDate() - (ACUTE_WINDOW_DAYS - 1));

  const dailyLoads = rows.map((row) => ({
    date: new Date(row.date),
    load: Number(row.rpe) * Number(row.duration),
  }));

  const chronicLoads = dailyLoads.map((d) => d.load);
  const acuteLoads = dailyLoads.filter((d) => d.date >= acuteCutoff).map((d) => d.load);

  const chronicLoad = average(chronicLoads);
  if (chronicLoad === 0) {
    return { status: "insufficient_data" };
  }

  const acuteLoad = acuteLoads.length > 0 ? average(acuteLoads) : 0;
  const acwr = acuteLoad / chronicLoad;

  return {
    status: "ok",
    acuteLoad,
    chronicLoad,
    acwr,
    zone: zoneFor(acwr),
  };
}
