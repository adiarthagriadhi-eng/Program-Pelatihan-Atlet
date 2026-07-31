import Link from "next/link";
import { getPool } from "@/lib/db";
import { calculateAcwr, type AcwrZone } from "@/lib/metrics/acwr";
import { calculateLatestReadiness, readinessZoneFor, type ReadinessZone } from "@/lib/metrics/readiness";

export const dynamic = "force-dynamic";

type AthleteRow = {
  id: number;
  name: string;
  sport_name: string;
};

type Zone = AcwrZone | ReadinessZone;

type DashboardRow = {
  athlete: AthleteRow;
  acwrZone: Zone | "tidak_cukup";
  acwrValue: number | null;
  readinessZone: Zone | "tidak_cukup";
  readinessValue: number | null;
  pendingRevisions: number;
};

const ZONE_RANK: Record<Zone | "tidak_cukup", number> = {
  risiko_tinggi: 0,
  perhatian: 1,
  aman: 2,
  tidak_cukup: 3,
};

const ZONE_LABELS: Record<Zone | "tidak_cukup", string> = {
  risiko_tinggi: "Risiko Tinggi",
  perhatian: "Perhatian",
  aman: "Aman",
  tidak_cukup: "Data Kurang",
};

const ZONE_DOT_CLASSES: Record<Zone | "tidak_cukup", string> = {
  risiko_tinggi: "bg-red-500",
  perhatian: "bg-amber-500",
  aman: "bg-green-500",
  tidak_cukup: "bg-zinc-300 dark:bg-zinc-700",
};

const ZONE_TEXT_CLASSES: Record<Zone | "tidak_cukup", string> = {
  risiko_tinggi: "text-red-700 dark:text-red-400",
  perhatian: "text-amber-700 dark:text-amber-400",
  aman: "text-green-700 dark:text-green-400",
  tidak_cukup: "text-zinc-400",
};

function TrafficLight({
  zone,
  value,
  decimals,
  unit,
}: {
  zone: Zone | "tidak_cukup";
  value: number | null;
  decimals: number;
  unit: string;
}) {
  return (
    <div className="flex items-center gap-2">
      <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${ZONE_DOT_CLASSES[zone]}`} />
      <span className={`text-sm font-medium ${ZONE_TEXT_CLASSES[zone]}`}>
        {value != null ? `${value.toFixed(decimals)}${unit}` : "-"}
      </span>
      <span className="text-xs text-zinc-500">{ZONE_LABELS[zone]}</span>
    </div>
  );
}

export default async function DashboardCoachPage() {
  let rows: DashboardRow[] = [];
  let loadError: string | null = null;

  try {
    const [{ rows: athletes }, { rows: revisionCounts }] = await Promise.all([
      getPool().query<AthleteRow>(
        `SELECT a.id, a.name, s.name AS sport_name
         FROM athletes a
         JOIN sports s ON a.sport_id = s.id
         ORDER BY a.name`
      ),
      getPool().query<{ athlete_id: number; pending_count: string }>(
        `SELECT p.athlete_id, COUNT(*) AS pending_count
         FROM revision_log rl
         JOIN training_programs p ON rl.program_id = p.id
         WHERE rl.status = 'pending_review'
         GROUP BY p.athlete_id`
      ),
    ]);

    const pendingByAthlete = new Map(
      revisionCounts.map((r) => [r.athlete_id, Number(r.pending_count)])
    );

    rows = await Promise.all(
      athletes.map(async (athlete) => {
        const [acwr, readiness] = await Promise.all([
          calculateAcwr(athlete.id),
          calculateLatestReadiness(athlete.id),
        ]);

        return {
          athlete,
          acwrZone: acwr.status === "ok" ? acwr.zone : "tidak_cukup",
          acwrValue: acwr.status === "ok" ? acwr.acwr : null,
          readinessZone: readiness.status === "ok" ? readinessZoneFor(readiness.score) : "tidak_cukup",
          readinessValue: readiness.status === "ok" ? readiness.score : null,
          pendingRevisions: pendingByAthlete.get(athlete.id) ?? 0,
        } satisfies DashboardRow;
      })
    );

    rows.sort((a, b) => {
      const rankA = Math.min(ZONE_RANK[a.acwrZone], ZONE_RANK[a.readinessZone]);
      const rankB = Math.min(ZONE_RANK[b.acwrZone], ZONE_RANK[b.readinessZone]);
      if (rankA !== rankB) return rankA - rankB;
      return a.athlete.name.localeCompare(b.athlete.name);
    });
  } catch (error) {
    console.error("Gagal memuat dashboard coach:", error);
    loadError = "Gagal terhubung ke database. Periksa koneksi lalu muat ulang halaman.";
  }

  const totalPendingRevisions = rows.reduce((sum, r) => sum + r.pendingRevisions, 0);
  const totalRisikoTinggi = rows.filter(
    (r) => r.acwrZone === "risiko_tinggi" || r.readinessZone === "risiko_tinggi"
  ).length;

  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-10 sm:py-16">
      <Link
        href="/"
        className="mb-6 inline-block text-sm text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200"
      >
        &larr; Kembali
      </Link>

      <h1 className="mb-1 text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
        Dashboard Coach
      </h1>
      <p className="mb-8 text-sm text-zinc-500">
        Status ACWR &amp; readiness semua atlet, urut dari yang paling perlu perhatian.
      </p>

      {loadError && (
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-300">
          {loadError}
        </div>
      )}

      {!loadError && (
        <div className="mb-6 grid gap-4 sm:grid-cols-3">
          <div className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
            <p className="text-xs text-zinc-500">Total Atlet</p>
            <p className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
              {rows.length}
            </p>
          </div>
          <div className="rounded-lg border border-red-200 bg-red-50 p-4 dark:border-red-900 dark:bg-red-950">
            <p className="text-xs text-red-700 dark:text-red-400">Risiko Tinggi</p>
            <p className="text-2xl font-semibold text-red-800 dark:text-red-300">
              {totalRisikoTinggi}
            </p>
          </div>
          <Link
            href="/revisi"
            className="rounded-lg border border-blue-200 bg-blue-50 p-4 transition hover:border-blue-400 dark:border-blue-900 dark:bg-blue-950"
          >
            <p className="text-xs text-blue-700 dark:text-blue-400">Revisi Pending</p>
            <p className="text-2xl font-semibold text-blue-800 dark:text-blue-300">
              {totalPendingRevisions}
            </p>
          </Link>
        </div>
      )}

      {!loadError && rows.length === 0 && (
        <div className="rounded-md border border-zinc-200 bg-zinc-50 px-4 py-6 text-center text-sm text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900">
          Belum ada atlet terdaftar.
        </div>
      )}

      {!loadError && rows.length > 0 && (
        <div className="overflow-x-auto rounded-lg border border-zinc-200 dark:border-zinc-800">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="bg-zinc-50 text-xs uppercase text-zinc-500 dark:bg-zinc-900 dark:text-zinc-400">
              <tr>
                <th className="px-4 py-3 font-medium">Atlet</th>
                <th className="px-4 py-3 font-medium">ACWR</th>
                <th className="px-4 py-3 font-medium">Readiness</th>
                <th className="px-4 py-3 font-medium">Revisi Pending</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
              {rows.map((row) => (
                <tr key={row.athlete.id}>
                  <td className="px-4 py-3 font-medium">
                    <Link
                      href={`/atlet/${row.athlete.id}`}
                      className="text-blue-600 hover:underline dark:text-blue-400"
                    >
                      {row.athlete.name}
                    </Link>
                    <p className="text-xs font-normal text-zinc-500">{row.athlete.sport_name}</p>
                  </td>
                  <td className="px-4 py-3">
                    <TrafficLight zone={row.acwrZone} value={row.acwrValue} decimals={2} unit="" />
                  </td>
                  <td className="px-4 py-3">
                    <TrafficLight
                      zone={row.readinessZone}
                      value={row.readinessValue}
                      decimals={1}
                      unit="/5"
                    />
                  </td>
                  <td className="px-4 py-3">
                    {row.pendingRevisions > 0 ? (
                      <Link
                        href="/revisi"
                        className="inline-block rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-medium text-blue-700 hover:bg-blue-200 dark:bg-blue-950 dark:text-blue-300 dark:hover:bg-blue-900"
                      >
                        {row.pendingRevisions} menunggu
                      </Link>
                    ) : (
                      <span className="text-xs text-zinc-400">-</span>
                    )}
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
