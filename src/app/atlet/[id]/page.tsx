import Link from "next/link";
import { notFound } from "next/navigation";
import { getPool } from "@/lib/db";
import { calculateAcwr, type AcwrResult } from "@/lib/metrics/acwr";
import {
  calculateLatestReadiness,
  readinessZoneFor,
  type ReadinessResult,
} from "@/lib/metrics/readiness";

export const dynamic = "force-dynamic";

type AthleteDetail = {
  id: number;
  name: string;
  sport_name: string;
  sex: string | null;
  birth_date: string | null;
  training_age_years: string | null;
};

const ZONE_LABELS: Record<string, string> = {
  aman: "Zona Aman",
  perhatian: "Perlu Perhatian",
  risiko_tinggi: "Risiko Tinggi",
};

const ZONE_CLASSES: Record<string, string> = {
  aman: "border-green-300 bg-green-50 text-green-800 dark:border-green-800 dark:bg-green-950 dark:text-green-300",
  perhatian:
    "border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-300",
  risiko_tinggi: "border-red-300 bg-red-50 text-red-800 dark:border-red-800 dark:bg-red-950 dark:text-red-300",
};

const READINESS_ZONE_LABELS: Record<string, string> = {
  aman: "Siap",
  perhatian: "Perlu Perhatian",
  risiko_tinggi: "Kurang Siap",
};

function formatDate(value: string | null): string {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" });
}

function calculateAge(birthDate: string | null): string {
  if (!birthDate) return "-";
  const birth = new Date(birthDate);
  if (Number.isNaN(birth.getTime())) return "-";

  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const hasNotHadBirthdayThisYear =
    today.getMonth() < birth.getMonth() ||
    (today.getMonth() === birth.getMonth() && today.getDate() < birth.getDate());
  if (hasNotHadBirthdayThisYear) age -= 1;

  return `${age} th`;
}

export default async function ProfilAtletPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const athleteId = Number(id);

  if (!Number.isInteger(athleteId) || athleteId <= 0) {
    notFound();
  }

  let athlete: AthleteDetail | null = null;
  let acwrResult: AcwrResult | null = null;
  let readinessResult: ReadinessResult | null = null;
  let loadError: string | null = null;

  try {
    const { rows } = await getPool().query<AthleteDetail>(
      `
      SELECT a.id, a.name, s.name AS sport_name, a.sex, a.birth_date, a.training_age_years
      FROM athletes a
      JOIN sports s ON a.sport_id = s.id
      WHERE a.id = $1
      `,
      [athleteId]
    );
    athlete = rows[0] ?? null;

    if (athlete) {
      [acwrResult, readinessResult] = await Promise.all([
        calculateAcwr(athleteId),
        calculateLatestReadiness(athleteId),
      ]);
    }
  } catch (error) {
    console.error("Gagal memuat profil atlet:", error);
    loadError = "Gagal terhubung ke database. Periksa koneksi lalu muat ulang halaman.";
  }

  if (!loadError && !athlete) {
    notFound();
  }

  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-10 sm:py-16">
      <Link
        href="/atlet"
        className="mb-6 inline-block text-sm text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200"
      >
        &larr; Kembali ke Daftar Atlet
      </Link>

      {loadError && (
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-300">
          {loadError}
        </div>
      )}

      {athlete && (
        <>
          <h1 className="mb-1 text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
            {athlete.name}
          </h1>
          <p className="mb-4 text-sm text-zinc-500">
            {athlete.sport_name} &middot; {athlete.sex ?? "-"} &middot;{" "}
            {calculateAge(athlete.birth_date)} &middot; Training age{" "}
            {athlete.training_age_years ? `${athlete.training_age_years} th` : "-"}
          </p>

          <Link
            href={`/atlet/${athlete.id}/program`}
            className="mb-8 inline-block rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-700"
          >
            Editor Program &rarr;
          </Link>

          <div className="grid gap-4 sm:grid-cols-2">
            <AcwrCard result={acwrResult} />
            <ReadinessCard result={readinessResult} />
          </div>
        </>
      )}
    </main>
  );
}

function AcwrCard({ result }: { result: AcwrResult | null }) {
  if (!result || result.status === "insufficient_data") {
    return (
      <div className="rounded-lg border border-zinc-200 p-5 dark:border-zinc-800">
        <h2 className="mb-1 font-medium text-zinc-900 dark:text-zinc-50">
          ACWR (Acute:Chronic Workload Ratio)
        </h2>
        <p className="text-sm text-zinc-500">
          Data belum cukup. Perlu riwayat RPE &amp; durasi sesi dari beberapa hari (lewat Input
          Assessment Harian) untuk menghitung ACWR.
        </p>
      </div>
    );
  }

  const zoneClass = ZONE_CLASSES[result.zone];
  const zoneLabel = ZONE_LABELS[result.zone];

  return (
    <div className={`rounded-lg border p-5 ${zoneClass}`}>
      <h2 className="mb-1 font-medium">ACWR</h2>
      <p className="mb-1 text-3xl font-semibold">{result.acwr.toFixed(2)}</p>
      <p className="mb-3 text-sm font-medium">{zoneLabel}</p>
      <dl className="space-y-1 text-xs opacity-80">
        <div className="flex justify-between gap-4">
          <dt>Acute load (rata-rata 7 hari)</dt>
          <dd>{result.acuteLoad.toFixed(1)}</dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt>Chronic load (rata-rata 28 hari)</dt>
          <dd>{result.chronicLoad.toFixed(1)}</dd>
        </div>
      </dl>
      {result.zone === "risiko_tinggi" && (
        <p className="mt-3 text-sm font-semibold">
          ⚠ Risiko tinggi — segera tinjau beban latihan bersama pelatih.
        </p>
      )}
    </div>
  );
}

function ReadinessCard({ result }: { result: ReadinessResult | null }) {
  if (!result || result.status === "no_data") {
    return (
      <div className="rounded-lg border border-zinc-200 p-5 dark:border-zinc-800">
        <h2 className="mb-1 font-medium text-zinc-900 dark:text-zinc-50">Readiness Score</h2>
        <p className="text-sm text-zinc-500">
          Belum ada satu hari pun dengan data kualitas tidur, muscle soreness, mood, dan stress
          yang lengkap.
        </p>
      </div>
    );
  }

  const zone = readinessZoneFor(result.score);
  const zoneClass = ZONE_CLASSES[zone];
  const zoneLabel = READINESS_ZONE_LABELS[zone];

  return (
    <div className={`rounded-lg border p-5 ${zoneClass}`}>
      <h2 className="mb-1 font-medium">Readiness Score</h2>
      <p className="mb-1 text-3xl font-semibold">
        {result.score.toFixed(1)} <span className="text-base font-normal opacity-70">/ 5.0</span>
      </p>
      <p className="mb-3 text-sm font-medium">{zoneLabel}</p>
      <p className="mb-3 text-xs opacity-80">Data tanggal {formatDate(result.date)}</p>
      <dl className="space-y-1 text-xs opacity-80">
        <div className="flex justify-between gap-4">
          <dt>Muscle soreness (mentah, sebelum dibalik)</dt>
          <dd>{result.details.muscleSoreness}</dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt>Mood</dt>
          <dd>{result.details.mood}</dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt>Stress</dt>
          <dd>{result.details.stress}</dd>
        </div>
      </dl>
    </div>
  );
}
