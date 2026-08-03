"use client";

import { useState, type FormEvent, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { PHASE_TYPES, PHASE_TYPE_LABELS, type PhaseType } from "@/lib/constants/phase";
import { GUIDELINE_TOPICS, GUIDELINE_TOPIC_LABELS, guidelineTopicLabel } from "@/lib/constants/guideline-topic";

export type GuidelineRow = {
  id: number;
  source_id: number;
  source_title: string;
  applicable_phase_type: PhaseType | null;
  topic: string | null;
  guideline_text: string;
  created_at: string;
};

type VerifiedSourceOption = { id: number; title: string };

type GroupKey = PhaseType | "all";
const GROUP_ORDER: GroupKey[] = ["all", ...PHASE_TYPES];
const GROUP_LABELS: Record<GroupKey, string> = { all: "Semua Fase", ...PHASE_TYPE_LABELS };

function groupByPhase(guidelines: GuidelineRow[]): Map<GroupKey, GuidelineRow[]> {
  const groups = new Map<GroupKey, GuidelineRow[]>();
  for (const guideline of guidelines) {
    const key: GroupKey = guideline.applicable_phase_type ?? "all";
    const list = groups.get(key) ?? [];
    list.push(guideline);
    groups.set(key, list);
  }
  return groups;
}

function inputClass(hasError: boolean) {
  return [
    "w-full rounded-md border px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 bg-white dark:bg-zinc-900 text-black dark:text-zinc-50",
    hasError
      ? "border-red-400 focus:ring-red-300"
      : "border-zinc-300 dark:border-zinc-700 focus:ring-blue-300",
  ].join(" ");
}

function Field({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: ReactNode;
}) {
  return (
    <div>
      <label className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
        {label}
      </label>
      {children}
      {error && <p className="mt-1 text-xs text-red-600 dark:text-red-400">{error}</p>}
    </div>
  );
}

const CUSTOM_TOPIC_VALUE = "__custom__";

function TopicField({
  value,
  onChange,
  error,
}: {
  value: string;
  onChange: (value: string) => void;
  error?: string;
}) {
  const isKnownTag = (GUIDELINE_TOPICS as readonly string[]).includes(value);
  const [customMode, setCustomMode] = useState(value !== "" && !isKnownTag);

  return (
    <Field label="Topic Tag (opsional)" error={error}>
      <select
        value={customMode ? CUSTOM_TOPIC_VALUE : value}
        onChange={(e) => {
          if (e.target.value === CUSTOM_TOPIC_VALUE) {
            setCustomMode(true);
            onChange("");
          } else {
            setCustomMode(false);
            onChange(e.target.value);
          }
        }}
        className={inputClass(!!error)}
      >
        <option value="">-- Tanpa topik --</option>
        {GUIDELINE_TOPICS.map((tag) => (
          <option key={tag} value={tag}>
            {GUIDELINE_TOPIC_LABELS[tag]}
          </option>
        ))}
        <option value={CUSTOM_TOPIC_VALUE}>Lainnya (tulis sendiri)...</option>
      </select>
      {customMode && (
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={`mt-2 ${inputClass(!!error)}`}
          placeholder="Tulis topic tag sendiri"
        />
      )}
    </Field>
  );
}

export default function TrainingGuidelinesPanel({
  sportId,
  verifiedSources,
  guidelines,
}: {
  sportId: number;
  verifiedSources: VerifiedSourceOption[];
  guidelines: GuidelineRow[];
}) {
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const grouped = groupByPhase(guidelines);

  return (
    <div className="space-y-4">
      {verifiedSources.length === 0 ? (
        <p className="rounded-md border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900">
          Belum ada sumber terverifikasi untuk cabang olahraga ini -- verifikasi minimal satu
          sumber dulu di atas sebelum bisa menambah kaidah pelatihan.
        </p>
      ) : adding ? (
        <AddGuidelineForm
          sportId={sportId}
          verifiedSources={verifiedSources}
          onDone={() => setAdding(false)}
        />
      ) : (
        <button
          type="button"
          onClick={() => setAdding(true)}
          className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-700"
        >
          + Tambah Kaidah
        </button>
      )}

      {guidelines.length === 0 ? (
        <p className="text-sm text-zinc-500">Belum ada kaidah pelatihan.</p>
      ) : (
        <div className="space-y-6">
          {GROUP_ORDER.filter((key) => grouped.has(key)).map((key) => (
            <div key={key}>
              <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-500">
                {GROUP_LABELS[key]} ({grouped.get(key)!.length})
              </h4>
              <ul className="space-y-3">
                {grouped.get(key)!.map((guideline) => (
                  <li
                    key={guideline.id}
                    className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-800"
                  >
                    {editingId === guideline.id ? (
                      <EditGuidelineForm
                        guideline={guideline}
                        onDone={() => setEditingId(null)}
                        onCancel={() => setEditingId(null)}
                      />
                    ) : (
                      <GuidelineCard
                        guideline={guideline}
                        onEdit={() => setEditingId(guideline.id)}
                      />
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function GuidelineCard({
  guideline,
  onEdit,
}: {
  guideline: GuidelineRow;
  onEdit: () => void;
}) {
  const router = useRouter();
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleDelete() {
    setError(null);
    setDeleting(true);
    try {
      const response = await fetch(`/api/training-guidelines/${guideline.id}`, {
        method: "DELETE",
      });
      const data = await response.json();
      if (!response.ok) {
        setError(data.message ?? "Gagal menghapus kaidah.");
        return;
      }
      router.refresh();
    } catch {
      setError("Tidak bisa terhubung ke server.");
    } finally {
      setDeleting(false);
    }
  }

  const topicLabel = guidelineTopicLabel(guideline.topic);

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2">
        {topicLabel && (
          <span className="inline-block rounded-full bg-zinc-100 px-2.5 py-0.5 text-xs font-medium text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
            {topicLabel}
          </span>
        )}
      </div>
      <p className="mt-2 whitespace-pre-wrap text-sm text-zinc-700 dark:text-zinc-300">
        {guideline.guideline_text}
      </p>
      <p className="mt-2 text-xs text-zinc-500">Sumber: {guideline.source_title}</p>

      {error && <p className="mt-2 text-xs text-red-600 dark:text-red-400">{error}</p>}

      <div className="mt-3 flex gap-3">
        <button
          type="button"
          onClick={onEdit}
          className="rounded-md border border-zinc-300 px-3 py-1.5 text-xs font-medium text-zinc-700 transition hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-900"
        >
          Edit
        </button>
        <button
          type="button"
          onClick={handleDelete}
          disabled={deleting}
          className="rounded-md border border-red-300 px-3 py-1.5 text-xs font-medium text-red-700 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-red-900 dark:text-red-400 dark:hover:bg-red-950"
        >
          {deleting ? "Menghapus..." : "Hapus"}
        </button>
      </div>
    </div>
  );
}

type GuidelineFieldState = {
  sourceId: string;
  applicablePhaseType: string;
  topic: string;
  guidelineText: string;
};
type GuidelineFormErrors = Partial<Record<keyof GuidelineFieldState | "_form", string[]>>;

function AddGuidelineForm({
  sportId,
  verifiedSources,
  onDone,
}: {
  sportId: number;
  verifiedSources: VerifiedSourceOption[];
  onDone: () => void;
}) {
  const router = useRouter();
  const [form, setForm] = useState<GuidelineFieldState>({
    sourceId: "",
    applicablePhaseType: "",
    topic: "",
    guidelineText: "",
  });
  const [errors, setErrors] = useState<GuidelineFormErrors>({});
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setErrors({});
    setSubmitting(true);

    try {
      const response = await fetch("/api/training-guidelines", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sportId: String(sportId),
          sourceId: form.sourceId,
          applicablePhaseType: form.applicablePhaseType || undefined,
          topic: form.topic || undefined,
          guidelineText: form.guidelineText,
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        setErrors(data.errors ?? { _form: [data.message ?? "Gagal menyimpan kaidah."] });
        return;
      }
      router.refresh();
      onDone();
    } catch {
      setErrors({ _form: ["Tidak bisa terhubung ke server."] });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-4 rounded-lg border border-blue-200 p-4 dark:border-blue-900"
      noValidate
    >
      {errors._form && (
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-300">
          {errors._form[0]}
        </div>
      )}

      <Field label="Sumber (terverifikasi)" error={errors.sourceId?.[0]}>
        <select
          value={form.sourceId}
          onChange={(e) => setForm((f) => ({ ...f, sourceId: e.target.value }))}
          className={inputClass(!!errors.sourceId)}
        >
          <option value="">-- Pilih sumber --</option>
          {verifiedSources.map((source) => (
            <option key={source.id} value={source.id}>
              {source.title}
            </option>
          ))}
        </select>
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Berlaku untuk Fase" error={errors.applicablePhaseType?.[0]}>
          <select
            value={form.applicablePhaseType}
            onChange={(e) => setForm((f) => ({ ...f, applicablePhaseType: e.target.value }))}
            className={inputClass(!!errors.applicablePhaseType)}
          >
            <option value="">Semua fase</option>
            {PHASE_TYPES.map((type) => (
              <option key={type} value={type}>
                {PHASE_TYPE_LABELS[type]}
              </option>
            ))}
          </select>
        </Field>
        <TopicField
          value={form.topic}
          onChange={(topic) => setForm((f) => ({ ...f, topic }))}
          error={errors.topic?.[0]}
        />
      </div>

      <Field label="Kaidah (kata-kata Anda sendiri)" error={errors.guidelineText?.[0]}>
        <textarea
          value={form.guidelineText}
          onChange={(e) => setForm((f) => ({ ...f, guidelineText: e.target.value }))}
          className={inputClass(!!errors.guidelineText)}
          rows={4}
        />
      </Field>

      <div className="flex gap-3">
        <button
          type="submit"
          disabled={submitting}
          className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {submitting ? "Menyimpan..." : "Simpan Kaidah"}
        </button>
        <button
          type="button"
          onClick={onDone}
          className="rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 transition hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-900"
        >
          Batal
        </button>
      </div>
    </form>
  );
}

function EditGuidelineForm({
  guideline,
  onDone,
  onCancel,
}: {
  guideline: GuidelineRow;
  onDone: () => void;
  onCancel: () => void;
}) {
  const router = useRouter();
  const [form, setForm] = useState<Omit<GuidelineFieldState, "sourceId">>({
    applicablePhaseType: guideline.applicable_phase_type ?? "",
    topic: guideline.topic ?? "",
    guidelineText: guideline.guideline_text,
  });
  const [errors, setErrors] = useState<GuidelineFormErrors>({});
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setErrors({});
    setSubmitting(true);

    try {
      const response = await fetch(`/api/training-guidelines/${guideline.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          applicablePhaseType: form.applicablePhaseType || undefined,
          topic: form.topic || undefined,
          guidelineText: form.guidelineText,
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        setErrors(data.errors ?? { _form: [data.message ?? "Gagal menyimpan perubahan."] });
        return;
      }
      router.refresh();
      onDone();
    } catch {
      setErrors({ _form: ["Tidak bisa terhubung ke server."] });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4" noValidate>
      {errors._form && (
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-300">
          {errors._form[0]}
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Berlaku untuk Fase" error={errors.applicablePhaseType?.[0]}>
          <select
            value={form.applicablePhaseType}
            onChange={(e) => setForm((f) => ({ ...f, applicablePhaseType: e.target.value }))}
            className={inputClass(!!errors.applicablePhaseType)}
          >
            <option value="">Semua fase</option>
            {PHASE_TYPES.map((type) => (
              <option key={type} value={type}>
                {PHASE_TYPE_LABELS[type]}
              </option>
            ))}
          </select>
        </Field>
        <TopicField
          value={form.topic}
          onChange={(topic) => setForm((f) => ({ ...f, topic }))}
          error={errors.topic?.[0]}
        />
      </div>

      <Field label="Kaidah" error={errors.guidelineText?.[0]}>
        <textarea
          value={form.guidelineText}
          onChange={(e) => setForm((f) => ({ ...f, guidelineText: e.target.value }))}
          className={inputClass(!!errors.guidelineText)}
          rows={4}
        />
      </Field>

      <div className="flex gap-3">
        <button
          type="submit"
          disabled={submitting}
          className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {submitting ? "Menyimpan..." : "Simpan Perubahan"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 transition hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-900"
        >
          Batal
        </button>
      </div>
    </form>
  );
}
