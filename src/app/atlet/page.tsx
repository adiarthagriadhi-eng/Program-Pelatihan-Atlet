import Link from "next/link";
import { getPool } from "@/lib/db";

export const dynamic = "force-dynamic";

type AthleteRow = {
  id: number;
  name: string;
  sport_name: string;
  sex: string | null;
  birth_date: string | null;
  training_age_years: string | null;
  phase_type: string | null;
  last_assessment_date: string | null;
};

const PHASE_LABELS: Record<string, string> = {
  general_prep: "Persiapan Umum",
  specific_prep: "Persiapan Khusus",
  pre_competition: "Pra-Kompetisi",
  competition: "Kompetisi",
  transition: "Transisi",
};

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

function formatDate(value: string | null): string {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" });
}

function PhaseBadge({ phaseType }: { phaseType: string | null }) {
  if (!phaseType) {
    return (
      <span className="inline-block rounded-full bg-zinc-100 px-2.5 py-0.5 text-xs font-medium text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
        Belum ada program
      </span>
    );
  }

  return (
    <span className="inline-block rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-medium text-blue-700 dark:bg-blue-950 dark:text-blue-300">
      {PHASE_LABELS[phaseType] ?? phaseType}
    </span>
  );
}

export default async function DaftarAtletPage() {
  let athletes: AthleteRow[] = [];
  let loadError: string | null = null;

  try {
    const result = await getPool().query<AthleteRow>(`
      SELECT
        a.id,
        a.name,
        s.name AS sport_name,
        a.sex,
        a.birth_date,
        a.training_age_years,
        tp.phase_type,
        (
          SELECT MAX(assessment_date)
          FROM assessments
          WHERE athlete_id = a.id
        ) AS last_assessment_date
      FROM athletes a
      JOIN sports s ON a.sport_id = s.id
      LEFT JOIN training_phases tp ON a.current_phase_id = tp.id
      ORDER BY a.name
    `);
    athletes = result.rows;
  } catch (error) {
    console.error("Gagal memuat daftar atlet:", error);
    loadError = "Gagal terhubung ke database. Periksa koneksi lalu muat ulang halaman.";
  }

  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-10 sm:py-16">
      <Link
        href="/"
        className="mb-6 inline-block text-sm text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200"
      >
        &larr; Kembali
      </Link>

      <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="mb-1 text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
            Daftar Atlet
          </h1>
          <p className="text-sm text-zinc-500">
            {athletes.length} atlet terdaftar.
          </p>
        </div>
        <Link
          href="/atlet/baru"
          className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-700"
        >
          + Tambah Atlet
        </Link>
      </div>

      {loadError && (
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-300">
          {loadError}
        </div>
      )}

      {!loadError && athletes.length === 0 && (
        <div className="rounded-md border border-zinc-200 bg-zinc-50 px-4 py-6 text-center text-sm text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900">
          Belum ada atlet terdaftar.
        </div>
      )}

      {!loadError && athletes.length > 0 && (
        <div className="overflow-x-auto rounded-lg border border-zinc-200 dark:border-zinc-800">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="bg-zinc-50 text-xs uppercase text-zinc-500 dark:bg-zinc-900 dark:text-zinc-400">
              <tr>
                <th className="px-4 py-3 font-medium">Nama</th>
                <th className="px-4 py-3 font-medium">Cabang Olahraga</th>
                <th className="px-4 py-3 font-medium">Jenis Kelamin</th>
                <th className="px-4 py-3 font-medium">Umur</th>
                <th className="px-4 py-3 font-medium">Training Age</th>
                <th className="px-4 py-3 font-medium">Fase Saat Ini</th>
                <th className="px-4 py-3 font-medium">Assessment Terakhir</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
              {athletes.map((athlete) => (
                <tr key={athlete.id}>
                  <td className="px-4 py-3 font-medium text-zinc-900 dark:text-zinc-50">
                    {athlete.name}
                  </td>
                  <td className="px-4 py-3 text-zinc-600 dark:text-zinc-300">
                    {athlete.sport_name}
                  </td>
                  <td className="px-4 py-3 text-zinc-600 dark:text-zinc-300">
                    {athlete.sex ?? "-"}
                  </td>
                  <td className="px-4 py-3 text-zinc-600 dark:text-zinc-300">
                    {calculateAge(athlete.birth_date)}
                  </td>
                  <td className="px-4 py-3 text-zinc-600 dark:text-zinc-300">
                    {athlete.training_age_years ? `${athlete.training_age_years} th` : "-"}
                  </td>
                  <td className="px-4 py-3">
                    <PhaseBadge phaseType={athlete.phase_type} />
                  </td>
                  <td className="px-4 py-3 text-zinc-600 dark:text-zinc-300">
                    {formatDate(athlete.last_assessment_date)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
