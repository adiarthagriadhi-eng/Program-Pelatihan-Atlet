import Link from "next/link";
import { getPool } from "@/lib/db";
import { MILESTONE_TYPE_LABELS, type MilestoneType } from "@/lib/constants/milestone";

export const dynamic = "force-dynamic";

type MilestoneRow = {
  id: number;
  athlete_id: number;
  athlete_name: string;
  target_date: string;
  milestone_type: MilestoneType;
  description: string | null;
  status: "pending" | "achieved" | "missed";
};

type DisplayStatus = "pending" | "achieved" | "missed";

const STATUS_LABELS: Record<DisplayStatus, string> = {
  pending: "Pending",
  achieved: "Tercapai",
  missed: "Terlewat",
};

const STATUS_CLASSES: Record<DisplayStatus, string> = {
  pending:
    "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300",
  achieved:
    "bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300",
  missed: "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300",
};

function displayStatus(milestone: MilestoneRow): DisplayStatus {
  if (milestone.status === "achieved") return "achieved";
  if (milestone.status === "missed") return "missed";

  // status di database masih 'pending' -- kalau tanggal targetnya sudah
  // lewat dan belum ditandai tercapai, tampilkan sebagai "Terlewat".
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(milestone.target_date);
  if (target < today) return "missed";

  return "pending";
}

function formatDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" });
}

export default async function DaftarMilestonePage() {
  let milestones: MilestoneRow[] = [];
  let loadError: string | null = null;

  try {
    const result = await getPool().query<MilestoneRow>(`
      SELECT
        m.id,
        m.athlete_id,
        a.name AS athlete_name,
        m.target_date,
        m.milestone_type,
        m.description,
        m.status
      FROM milestones m
      JOIN athletes a ON m.athlete_id = a.id
      ORDER BY m.target_date ASC
    `);
    milestones = result.rows;
  } catch (error) {
    console.error("Gagal memuat daftar milestone:", error);
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

      <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="mb-1 text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
            Daftar Milestone
          </h1>
          <p className="text-sm text-zinc-500">{milestones.length} milestone tercatat.</p>
        </div>
        <Link
          href="/milestone/baru"
          className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-700"
        >
          + Tambah Milestone
        </Link>
      </div>

      {loadError && (
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-300">
          {loadError}
        </div>
      )}

      {!loadError && milestones.length === 0 && (
        <div className="rounded-md border border-zinc-200 bg-zinc-50 px-4 py-6 text-center text-sm text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900">
          Belum ada milestone tercatat.
        </div>
      )}

      {!loadError && milestones.length > 0 && (
        <div className="overflow-x-auto rounded-lg border border-zinc-200 dark:border-zinc-800">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="bg-zinc-50 text-xs uppercase text-zinc-500 dark:bg-zinc-900 dark:text-zinc-400">
              <tr>
                <th className="px-4 py-3 font-medium">Tanggal Target</th>
                <th className="px-4 py-3 font-medium">Atlet</th>
                <th className="px-4 py-3 font-medium">Jenis</th>
                <th className="px-4 py-3 font-medium">Deskripsi</th>
                <th className="px-4 py-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
              {milestones.map((milestone) => {
                const status = displayStatus(milestone);
                return (
                  <tr key={milestone.id}>
                    <td className="px-4 py-3 font-medium text-zinc-900 dark:text-zinc-50">
                      {formatDate(milestone.target_date)}
                    </td>
                    <td className="px-4 py-3 text-zinc-600 dark:text-zinc-300">
                      <Link
                        href={`/atlet/${milestone.athlete_id}`}
                        className="text-blue-600 hover:underline dark:text-blue-400"
                      >
                        {milestone.athlete_name}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-zinc-600 dark:text-zinc-300">
                      {MILESTONE_TYPE_LABELS[milestone.milestone_type]}
                    </td>
                    <td className="px-4 py-3 text-zinc-600 dark:text-zinc-300">
                      {milestone.description ?? "-"}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_CLASSES[status]}`}
                      >
                        {STATUS_LABELS[status]}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
