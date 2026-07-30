import Link from "next/link";
import { getPool } from "@/lib/db";
import MilestoneForm from "@/components/milestone/MilestoneForm";

export const dynamic = "force-dynamic";

export default async function TambahMilestonePage() {
  let athletes: { id: number; name: string }[] = [];
  let loadError: string | null = null;

  try {
    const result = await getPool().query<{ id: number; name: string }>(
      "SELECT id, name FROM athletes ORDER BY name"
    );
    athletes = result.rows;
  } catch (error) {
    console.error("Gagal memuat daftar atlet:", error);
    loadError = "Gagal terhubung ke database. Periksa koneksi lalu muat ulang halaman.";
  }

  return (
    <main className="mx-auto w-full max-w-xl px-4 py-10 sm:py-16">
      <Link
        href="/"
        className="mb-6 inline-block text-sm text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200"
      >
        &larr; Kembali
      </Link>
      <h1 className="mb-1 text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
        Tambah Milestone
      </h1>
      <p className="mb-8 text-sm text-zinc-500">
        Catat target penting atlet: kompetisi, tanggal tes, transisi fase, atau target PR.
      </p>
      {loadError ? (
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-300">
          {loadError}
        </div>
      ) : (
        <MilestoneForm athletes={athletes} />
      )}
    </main>
  );
}
