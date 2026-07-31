import Link from "next/link";
import { notFound } from "next/navigation";
import { getPool } from "@/lib/db";
import ProgramForm from "@/components/program/ProgramForm";
import PhaseTimeline, { type PhaseRow } from "@/components/program/PhaseTimeline";

export const dynamic = "force-dynamic";

type AthleteRow = {
  id: number;
  name: string;
  sport_name: string;
};

type ProgramRow = {
  id: number;
  start_date: string;
  end_date: string | null;
  macrocycle_goal: string | null;
  status: "draft" | "active" | "archived";
  version_number: number;
};

const STATUS_LABELS: Record<ProgramRow["status"], string> = {
  draft: "Draft",
  active: "Aktif",
  archived: "Diarsipkan",
};

function formatDate(value: string | null): string {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" });
}

export default async function EditorProgramPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const athleteId = Number(id);

  if (!Number.isInteger(athleteId) || athleteId <= 0) {
    notFound();
  }

  let athlete: AthleteRow | null = null;
  let program: ProgramRow | null = null;
  let phases: PhaseRow[] = [];
  let loadError: string | null = null;

  try {
    const { rows: athleteRows } = await getPool().query<AthleteRow>(
      `SELECT a.id, a.name, s.name AS sport_name
       FROM athletes a
       JOIN sports s ON a.sport_id = s.id
       WHERE a.id = $1`,
      [athleteId]
    );
    athlete = athleteRows[0] ?? null;

    if (athlete) {
      const { rows: programRows } = await getPool().query<ProgramRow>(
        `SELECT id, start_date, end_date, macrocycle_goal, status, version_number
         FROM training_programs
         WHERE athlete_id = $1
         ORDER BY created_at DESC
         LIMIT 1`,
        [athleteId]
      );
      program = programRows[0] ?? null;

      if (program) {
        const { rows: phaseRows } = await getPool().query<PhaseRow>(
          `SELECT id, program_id, phase_type, week_number, start_date, end_date,
                  primary_focus, planned_volume, planned_intensity, target_load_index
           FROM training_phases
           WHERE program_id = $1
           ORDER BY start_date ASC`,
          [program.id]
        );
        phases = phaseRows;
      }
    }
  } catch (error) {
    console.error("Gagal memuat editor program:", error);
    loadError = "Gagal terhubung ke database. Periksa koneksi lalu muat ulang halaman.";
  }

  if (!loadError && !athlete) {
    notFound();
  }

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-10 sm:py-16">
      <Link
        href={`/atlet/${athleteId}`}
        className="mb-6 inline-block text-sm text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200"
      >
        &larr; Kembali ke Profil Atlet
      </Link>

      {loadError && (
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-300">
          {loadError}
        </div>
      )}

      {athlete && (
        <>
          <h1 className="mb-1 text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
            Editor Program &mdash; {athlete.name}
          </h1>
          <p className="mb-8 text-sm text-zinc-500">{athlete.sport_name}</p>

          {!program && <ProgramForm athleteId={athleteId} />}

          {program && (
            <>
              <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
                <div>
                  <p className="text-sm font-medium text-zinc-900 dark:text-zinc-50">
                    {formatDate(program.start_date)} &ndash; {formatDate(program.end_date)}
                    {" "}
                    <span className="text-zinc-500">(v{program.version_number})</span>
                  </p>
                  {program.macrocycle_goal && (
                    <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-300">
                      {program.macrocycle_goal}
                    </p>
                  )}
                </div>
                <span className="inline-block rounded-full bg-zinc-100 px-2.5 py-0.5 text-xs font-medium text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
                  {STATUS_LABELS[program.status]}
                </span>
              </div>

              <h2 className="mb-3 text-sm font-medium text-zinc-700 dark:text-zinc-300">
                Timeline Periodisasi
              </h2>
              <PhaseTimeline programId={program.id} phases={phases} />
            </>
          )}
        </>
      )}
    </main>
  );
}
