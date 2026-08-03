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
 * ACWR = rata-rata beban harian (jumlah actual_rpe x actual_duration_minutes
 * semua sesi hari itu) 7 hari terakhir dibagi rata-rata beban harian 28
 * hari terakhir. Beban diambil dari training_sessions lewat view
 * v_athlete_session_load -- BUKAN lagi dari tabel `assessments`, karena
 * assessment_type tidak lagi punya 'session_duration' sejak migrasi ke
 * Basis Pengetahuan Statis (lihat migrations/002_...). Konsekuensinya:
 * ACWR sekarang butuh training_sessions.actual_rpe & actual_duration_minutes
 * terisi (dicatat per sesi terjadwal di Editor Program), bukan lagi dari
 * Input Assessment Harian.
 */
export async function calculateAcwr(athleteId: number): Promise<AcwrResult> {
  const { rows } = await getPool().query<{
    date: string;
    load: string;
  }>(
    `
    SELECT session_date AS date, SUM(session_load) AS load
    FROM v_athlete_session_load
    WHERE athlete_id = $1
      AND session_date >= CURRENT_DATE - ($2 * INTERVAL '1 day')
      AND session_date <= CURRENT_DATE
    GROUP BY session_date
    ORDER BY session_date
    `,
    [athleteId, CHRONIC_WINDOW_DAYS - 1]
  );

  if (rows.length < MIN_CHRONIC_DAYS_WITH_DATA) {
    return { status: "insufficient_data" };
  }

  // Kolom DATE dari PostgreSQL selalu dibaca node-postgres sebagai UTC
  // tengah malam, jadi cutoff-nya juga dihitung di UTC supaya batas
  // 7/28 hari tidak bergeser tergantung timezone server.
  const acuteCutoff = new Date();
  acuteCutoff.setUTCHours(0, 0, 0, 0);
  acuteCutoff.setUTCDate(acuteCutoff.getUTCDate() - (ACUTE_WINDOW_DAYS - 1));

  const dailyLoads = rows.map((row) => ({
    date: new Date(row.date),
    load: Number(row.load),
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
