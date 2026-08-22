import Link from "next/link";
import { buildNutritionExport } from "@/lib/nutrition-export";
import NutritionExportDownloadButton from "@/components/export/NutritionExportDownloadButton";

export const dynamic = "force-dynamic";

export default async function ExportNutrisiPage() {
  let result: Awaited<ReturnType<typeof buildNutritionExport>> | null = null;
  let loadError: string | null = null;

  try {
    result = await buildNutritionExport();
  } catch (error) {
    console.error("Gagal memuat data ekspor nutrisi:", error);
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
        Export ke Nutrition Engine
      </h1>
      <p className="mb-8 text-sm text-zinc-500">
        Ekspor profil &amp; skema latihan mingguan atlet atletik/renang, sesuai kontrak data
        Nutrition Engine.
      </p>

      {loadError && (
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-300">
          {loadError}
        </div>
      )}

      {result && (
        <>
          <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
            <div>
              <p className="text-sm font-medium text-zinc-900 dark:text-zinc-50">
                {result.payload.athletes.length} atlet siap diekspor
              </p>
              <p className="text-xs text-zinc-500">
                {result.excludedAthletes.length} atlet dikecualikan (lihat rincian di bawah)
              </p>
            </div>
            <NutritionExportDownloadButton label="Unduh Semua (JSON)" />
          </div>

          {result.payload.limitations.length > 0 && (
            <div className="mb-6 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-300">
              <p className="mb-2 font-medium">Keterbatasan data (limitations)</p>
              <ul className="list-inside list-disc space-y-1">
                {result.payload.limitations.map((note, i) => (
                  <li key={i}>{note}</li>
                ))}
              </ul>
            </div>
          )}

          <h2 className="mb-3 font-medium text-zinc-900 dark:text-zinc-50">
            Atlet yang disertakan
          </h2>
          {result.payload.athletes.length === 0 ? (
            <p className="mb-8 text-sm text-zinc-500">
              Belum ada atlet yang memenuhi syarat ekspor.
            </p>
          ) : (
            <div className="mb-8 overflow-x-auto rounded-lg border border-zinc-200 dark:border-zinc-800">
              <table className="w-full min-w-[640px] text-left text-sm">
                <thead className="bg-zinc-50 text-xs uppercase text-zinc-500 dark:bg-zinc-900 dark:text-zinc-400">
                  <tr>
                    <th className="px-4 py-3 font-medium">Atlet</th>
                    <th className="px-4 py-3 font-medium">Cabang</th>
                    <th className="px-4 py-3 font-medium">Fase</th>
                    <th className="px-4 py-3 font-medium">Sesi (7 hari)</th>
                    <th className="px-4 py-3 font-medium"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                  {result.payload.athletes.map((athlete) => (
                    <tr key={athlete.athleteId}>
                      <td className="px-4 py-3 font-medium">
                        <Link
                          href={`/atlet/${athlete.athleteId}`}
                          className="text-blue-600 hover:underline dark:text-blue-400"
                        >
                          {athlete.athleteName}
                        </Link>
                        <p className="text-xs font-normal text-zinc-500">
                          {athlete.category} &middot; {athlete.event}
                        </p>
                      </td>
                      <td className="px-4 py-3 capitalize">{athlete.sport}</td>
                      <td className="px-4 py-3">{athlete.phaseLabel ?? "-"}</td>
                      <td className="px-4 py-3">{athlete.weeklySessions.length}</td>
                      <td className="px-4 py-3">
                        <NutritionExportDownloadButton
                          athleteId={athlete.athleteId}
                          label="Unduh"
                          compact
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {result.excludedAthletes.length > 0 && (
            <>
              <h2 className="mb-3 font-medium text-zinc-900 dark:text-zinc-50">
                Atlet yang dikecualikan
              </h2>
              <div className="overflow-x-auto rounded-lg border border-zinc-200 dark:border-zinc-800">
                <table className="w-full min-w-[480px] text-left text-sm">
                  <thead className="bg-zinc-50 text-xs uppercase text-zinc-500 dark:bg-zinc-900 dark:text-zinc-400">
                    <tr>
                      <th className="px-4 py-3 font-medium">Atlet</th>
                      <th className="px-4 py-3 font-medium">Alasan</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                    {result.excludedAthletes.map((excluded) => (
                      <tr key={excluded.athleteId}>
                        <td className="px-4 py-3 font-medium">
                          <Link
                            href={`/atlet/${excluded.athleteId}`}
                            className="text-blue-600 hover:underline dark:text-blue-400"
                          >
                            {excluded.athleteName}
                          </Link>
                        </td>
                        <td className="px-4 py-3 text-zinc-600 dark:text-zinc-400">
                          {excluded.reason}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </>
      )}
    </main>
  );
}
