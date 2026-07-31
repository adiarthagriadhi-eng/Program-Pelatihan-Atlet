import Link from "next/link";
import { getPool } from "@/lib/db";
import RevisionCard, { type RevisionRow } from "@/components/revision/RevisionCard";

export const dynamic = "force-dynamic";

export default async function RevisiPage() {
  let revisions: RevisionRow[] = [];
  let loadError: string | null = null;

  try {
    const { rows } = await getPool().query<RevisionRow>(
      `
      SELECT
        rl.id,
        a.id AS athlete_id,
        a.name AS athlete_name,
        s.name AS sport_name,
        rl.trigger_summary,
        rl.proposed_changes,
        rl.source_citations,
        rl.created_at,
        tp.id AS phase_id,
        tp.phase_type,
        tp.primary_focus,
        tp.planned_volume,
        tp.planned_intensity,
        tp.target_load_index
      FROM revision_log rl
      JOIN training_programs p ON rl.program_id = p.id
      JOIN athletes a ON p.athlete_id = a.id
      JOIN sports s ON a.sport_id = s.id
      LEFT JOIN training_phases tp ON tp.id = (rl.proposed_changes->>'phase_id')::int
      WHERE rl.status = 'pending_review'
      ORDER BY rl.created_at DESC
      `
    );
    revisions = rows;
  } catch (error) {
    console.error("Gagal memuat daftar revisi:", error);
    loadError = "Gagal terhubung ke database. Periksa koneksi lalu muat ulang halaman.";
  }

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-10 sm:py-16">
      <Link
        href="/"
        className="mb-6 inline-block text-sm text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200"
      >
        &larr; Kembali ke Beranda
      </Link>

      <h1 className="mb-1 text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
        Review Revisi
      </h1>
      <p className="mb-8 text-sm text-zinc-500">
        Draft usulan perubahan program dari temuan literatur, menunggu persetujuan Anda.
      </p>

      {loadError && (
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-300">
          {loadError}
        </div>
      )}

      {!loadError && revisions.length === 0 && (
        <div className="rounded-md border border-zinc-200 bg-zinc-50 px-4 py-6 text-center text-sm text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900">
          Tidak ada revisi yang menunggu review.
        </div>
      )}

      <div className="space-y-5">
        {revisions.map((revision) => (
          <RevisionCard key={revision.id} revision={revision} />
        ))}
      </div>
    </main>
  );
}
