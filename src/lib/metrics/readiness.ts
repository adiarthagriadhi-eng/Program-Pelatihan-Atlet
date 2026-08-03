import { getPool } from "@/lib/db";

// 'sleep_quality' dihapus dari assessment_type saat migrasi ke Basis
// Pengetahuan Statis (lihat migrations/002_...) -- tidak ada pengganti
// metrik kualitas tidur subjektif di enum baru, jadi readiness sekarang
// dihitung dari 3 metrik yang tersisa.
const REQUIRED_TYPES = ["muscle_soreness", "mood", "stress"] as const;

export type ReadinessZone = "aman" | "perhatian" | "risiko_tinggi";

// Ambang belum ada rujukan baku (beda dari ACWR) -- ini angka yang
// disepakati bersama pengguna aplikasi: >=4.0 hijau, 2.5-4.0 kuning,
// <2.5 merah, dari skala 1-5.
export function readinessZoneFor(score: number): ReadinessZone {
  if (score >= 4) return "aman";
  if (score >= 2.5) return "perhatian";
  return "risiko_tinggi";
}

export type ReadinessResult =
  | {
      status: "ok";
      date: string;
      score: number;
      details: {
        muscleSoreness: number;
        mood: number;
        stress: number;
      };
    }
  | { status: "no_data" };

// node-postgres mengembalikan kolom DATE sebagai objek Date, bukan string
// -- perlu dinormalisasi ke string supaya bisa dipakai sebagai key Map
// (dua objek Date untuk tanggal yang sama adalah instance berbeda, jadi
// tidak akan pernah dianggap "sama" kalau dipakai langsung sebagai key).
function toDateKey(value: string | Date): string {
  if (value instanceof Date) {
    return value.toISOString().slice(0, 10);
  }
  return value;
}

/**
 * Readiness score = rata-rata dari muscle_soreness (dibalik: 6 - nilai,
 * karena skalanya 1=tidak nyeri .. 5=sangat nyeri), mood, dan stress --
 * diambil dari hari terakhir yang punya ketiga metrik itu lengkap
 * (bukan harus hari ini).
 */
export async function calculateLatestReadiness(athleteId: number): Promise<ReadinessResult> {
  const { rows } = await getPool().query<{
    assessment_date: string | Date;
    type: string;
    value: string;
  }>(
    `
    SELECT assessment_date, type, value
    FROM assessments
    WHERE athlete_id = $1
      AND type IN ('muscle_soreness', 'mood', 'stress')
    ORDER BY assessment_date DESC
    `,
    [athleteId]
  );

  const byDate = new Map<string, Record<string, number>>();
  for (const row of rows) {
    const dateKey = toDateKey(row.assessment_date);
    const entry = byDate.get(dateKey) ?? {};
    entry[row.type] = Number(row.value);
    byDate.set(dateKey, entry);
  }

  for (const [date, values] of byDate) {
    const hasAll = REQUIRED_TYPES.every((type) => type in values);
    if (!hasAll) continue;

    const invertedSoreness = 6 - values.muscle_soreness;
    const score = (invertedSoreness + values.mood + values.stress) / 3;

    return {
      status: "ok",
      date,
      score,
      details: {
        muscleSoreness: values.muscle_soreness,
        mood: values.mood,
        stress: values.stress,
      },
    };
  }

  return { status: "no_data" };
}
