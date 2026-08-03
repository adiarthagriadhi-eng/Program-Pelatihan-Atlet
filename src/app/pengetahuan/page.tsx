import Link from "next/link";
import { getPool } from "@/lib/db";

export const dynamic = "force-dynamic";

type SportRow = {
  id: number;
  name: string;
  category: string;
  knowledge_status: "ready" | "under_construction";
  verified_source_count: string;
  guideline_count: string;
};

const STATUS_LABELS: Record<SportRow["knowledge_status"], string> = {
  ready: "Ready",
  under_construction: "Under Construction",
};

// Sesuai permintaan: abu-abu untuk Under Construction, hijau untuk Ready.
const STATUS_CLASSES: Record<SportRow["knowledge_status"], string> = {
  ready: "bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300",
  under_construction: "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400",
};

export default async function BasisPengetahuanPage() {
  let sports: SportRow[] = [];
  let loadError: string | null = null;

  try {
    const { rows } = await getPool().query<SportRow>(
      `
      SELECT
        s.id, s.name, s.category, s.knowledge_status,
        (SELECT COUNT(*) FROM knowledge_sources ks WHERE ks.sport_id = s.id AND ks.verified = true) AS verified_source_count,
        (SELECT COUNT(*) FROM training_guidelines tg WHERE tg.sport_id = s.id) AS guideline_count
      FROM sports s
      ORDER BY s.name
      `
    );
    sports = rows;
  } catch (error) {
    console.error("Gagal memuat basis pengetahuan:", error);
    loadError = "Gagal terhubung ke database. Periksa koneksi lalu muat ulang halaman.";
  }

  return (
    <main className="mx-auto w-full max-w-4xl px-4 py-10 sm:py-16">
      <Link
        href="/"
        className="mb-6 inline-block text-sm text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200"
      >
        &larr; Kembali
      </Link>

      <h1 className="mb-1 text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
        Basis Pengetahuan per Cabor
      </h1>
      <p className="mb-8 text-sm text-zinc-500">
        Pilih cabang olahraga untuk kelola sumber &amp; kaidah pelatihan. Sistem hanya bisa
        mengusulkan revisi program untuk cabor yang statusnya &quot;Ready&quot;.
      </p>

      {loadError && (
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-300">
          {loadError}
        </div>
      )}

      {!loadError && sports.length === 0 && (
        <div className="rounded-md border border-zinc-200 bg-zinc-50 px-4 py-6 text-center text-sm text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900">
          Belum ada cabang olahraga terdaftar.
        </div>
      )}

      {!loadError && sports.length > 0 && (
        <div className="overflow-x-auto rounded-lg border border-zinc-200 dark:border-zinc-800">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="bg-zinc-50 text-xs uppercase text-zinc-500 dark:bg-zinc-900 dark:text-zinc-400">
              <tr>
                <th className="px-4 py-3 font-medium">Cabang Olahraga</th>
                <th className="px-4 py-3 font-medium">Kategori</th>
                <th className="px-4 py-3 font-medium">Sumber Terverifikasi</th>
                <th className="px-4 py-3 font-medium">Kaidah</th>
                <th className="px-4 py-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
              {sports.map((sport) => (
                <tr key={sport.id}>
                  <td className="px-4 py-3 font-medium">
                    <Link
                      href={`/pengetahuan/${sport.id}`}
                      className="text-blue-600 hover:underline dark:text-blue-400"
                    >
                      {sport.name}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-zinc-600 dark:text-zinc-300">{sport.category}</td>
                  <td className="px-4 py-3 text-zinc-600 dark:text-zinc-300">
                    {sport.verified_source_count}
                  </td>
                  <td className="px-4 py-3 text-zinc-600 dark:text-zinc-300">
                    {sport.guideline_count}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_CLASSES[sport.knowledge_status]}`}
                    >
                      {STATUS_LABELS[sport.knowledge_status]}
                    </span>
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
