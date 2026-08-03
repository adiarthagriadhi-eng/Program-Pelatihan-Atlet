import Link from "next/link";
import { notFound } from "next/navigation";
import { getPool } from "@/lib/db";
import KnowledgeSourcesPanel, {
  type KnowledgeSourceRow,
} from "@/components/knowledge/KnowledgeSourcesPanel";
import TrainingGuidelinesPanel, {
  type GuidelineRow,
} from "@/components/knowledge/TrainingGuidelinesPanel";

export const dynamic = "force-dynamic";

type SportDetail = {
  id: number;
  name: string;
  category: string;
  knowledge_status: "ready" | "under_construction";
};

const STATUS_LABELS: Record<SportDetail["knowledge_status"], string> = {
  ready: "Siap",
  under_construction: "Under Construction",
};

const STATUS_CLASSES: Record<SportDetail["knowledge_status"], string> = {
  ready: "bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300",
  under_construction: "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
};

export default async function KnowledgeBaseSportPage({
  params,
}: {
  params: Promise<{ sportId: string }>;
}) {
  const { sportId } = await params;
  const sportIdNum = Number(sportId);

  if (!Number.isInteger(sportIdNum) || sportIdNum <= 0) {
    notFound();
  }

  let sport: SportDetail | null = null;
  let sources: KnowledgeSourceRow[] = [];
  let guidelines: GuidelineRow[] = [];
  let loadError: string | null = null;

  try {
    const { rows: sportRows } = await getPool().query<SportDetail>(
      `SELECT id, name, category, knowledge_status FROM sports WHERE id = $1`,
      [sportIdNum]
    );
    sport = sportRows[0] ?? null;

    if (sport) {
      const [{ rows: sourceRows }, { rows: guidelineRows }] = await Promise.all([
        getPool().query<KnowledgeSourceRow>(
          `
          SELECT id, title, source_url, source_type, uploaded_content, verified, verified_at, created_at
          FROM knowledge_sources
          WHERE sport_id = $1
          ORDER BY created_at DESC
          `,
          [sportIdNum]
        ),
        getPool().query<GuidelineRow>(
          `
          SELECT tg.id, tg.source_id, ks.title AS source_title, tg.applicable_phase_type,
                 tg.topic, tg.guideline_text, tg.created_at
          FROM training_guidelines tg
          JOIN knowledge_sources ks ON ks.id = tg.source_id
          WHERE tg.sport_id = $1
          ORDER BY tg.created_at DESC
          `,
          [sportIdNum]
        ),
      ]);
      sources = sourceRows;
      guidelines = guidelineRows;
    }
  } catch (error) {
    console.error("Gagal memuat detail basis pengetahuan:", error);
    loadError = "Gagal terhubung ke database. Periksa koneksi lalu muat ulang halaman.";
  }

  if (!loadError && !sport) {
    notFound();
  }

  const verifiedSources = sources.filter((s) => s.verified);
  const draftSources = sources.filter((s) => !s.verified);

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-10 sm:py-16">
      <Link
        href="/pengetahuan"
        className="mb-6 inline-block text-sm text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200"
      >
        &larr; Kembali ke Basis Pengetahuan
      </Link>

      {loadError && (
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-300">
          {loadError}
        </div>
      )}

      {sport && (
        <>
          <div className="mb-8 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1 className="mb-1 text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
                {sport.name}
              </h1>
              <p className="text-sm text-zinc-500">{sport.category}</p>
            </div>
            <span
              className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_CLASSES[sport.knowledge_status]}`}
            >
              {STATUS_LABELS[sport.knowledge_status]}
            </span>
          </div>

          <section className="mb-10">
            <h2 className="mb-3 text-lg font-medium text-zinc-900 dark:text-zinc-50">
              Sumber Pengetahuan
            </h2>
            <KnowledgeSourcesPanel
              sportId={sportIdNum}
              draftSources={draftSources}
              verifiedSources={verifiedSources}
            />
          </section>

          <section>
            <h2 className="mb-3 text-lg font-medium text-zinc-900 dark:text-zinc-50">
              Kaidah Pelatihan
            </h2>
            <TrainingGuidelinesPanel
              sportId={sportIdNum}
              verifiedSources={verifiedSources.map((s) => ({ id: s.id, title: s.title }))}
              guidelines={guidelines}
            />
          </section>
        </>
      )}
    </main>
  );
}
