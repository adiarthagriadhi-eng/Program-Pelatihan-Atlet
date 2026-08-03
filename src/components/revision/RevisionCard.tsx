"use client";

import { useState, type FormEvent, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { PHASE_TYPE_LABELS, type PhaseType } from "@/lib/constants/phase";

type ProposedChanges = {
  phase_id: number;
  volume_delta_percent: number | null;
  intensity_delta_percent: number | null;
  session_type_swap: { from: string; to: string } | null;
  rationale: string;
};

type Citation = { guideline_id: number; url: string | null; note: string | null };

export type RevisionRow = {
  id: number;
  athlete_id: number;
  athlete_name: string;
  sport_name: string;
  trigger_summary: string | null;
  proposed_changes: ProposedChanges;
  source_citations: Citation[];
  created_at: string;
  phase_id: number | null;
  phase_type: PhaseType | null;
  primary_focus: string | null;
  planned_volume: string | null;
  planned_intensity: string | null;
  target_load_index: string | null;
};

function applyPercent(current: string | null, deltaPercent: number | null): string {
  if (deltaPercent == null) return "-";
  if (current == null) return `${deltaPercent > 0 ? "+" : ""}${deltaPercent}% (belum ada nilai dasar)`;
  const next = Number(current) * (1 + deltaPercent / 100);
  return `${next.toFixed(2)} (${deltaPercent > 0 ? "+" : ""}${deltaPercent}%)`;
}

function formatDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" });
}

export default function RevisionCard({ revision }: { revision: RevisionRow }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [submitting, setSubmitting] = useState<"approve" | "reject" | null>(null);
  const [error, setError] = useState<string | null>(null);

  const changes = revision.proposed_changes;

  async function handleAction(action: "approve" | "reject") {
    setError(null);
    setSubmitting(action);
    try {
      const response = await fetch(`/api/revisions/${revision.id}/${action}`, {
        method: "POST",
      });
      const data = await response.json();
      if (!response.ok) {
        setError(data.message ?? "Gagal memproses revisi.");
        return;
      }
      router.refresh();
    } catch {
      setError("Tidak bisa terhubung ke server. Periksa koneksi internet Anda.");
    } finally {
      setSubmitting(null);
    }
  }

  return (
    <div className="rounded-lg border border-zinc-200 p-5 dark:border-zinc-800">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="font-medium text-zinc-900 dark:text-zinc-50">
            {revision.athlete_name} &middot; {revision.sport_name}
          </p>
          <p className="mt-0.5 text-xs text-zinc-500">
            {revision.trigger_summary ?? "Dipicu oleh literatur otomatis"} &middot;{" "}
            {formatDate(revision.created_at)}
          </p>
        </div>
        {revision.phase_type && (
          <span className="inline-block rounded-full bg-zinc-100 px-2.5 py-0.5 text-xs font-medium text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
            {PHASE_TYPE_LABELS[revision.phase_type]}
          </span>
        )}
      </div>

      {error && (
        <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-300">
          {error}
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-md border border-zinc-200 p-3 dark:border-zinc-800">
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-500">
            Kondisi Saat Ini
          </h3>
          <dl className="space-y-1 text-sm text-zinc-700 dark:text-zinc-300">
            <div className="flex justify-between gap-2">
              <dt>Fokus utama</dt>
              <dd className="text-right">{revision.primary_focus ?? "-"}</dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt>Volume rencana</dt>
              <dd>{revision.planned_volume ?? "-"}</dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt>Intensitas rencana</dt>
              <dd>{revision.planned_intensity ?? "-"}</dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt>Target load index</dt>
              <dd>{revision.target_load_index ?? "-"}</dd>
            </div>
          </dl>
        </div>

        <div className="rounded-md border border-blue-200 bg-blue-50/50 p-3 dark:border-blue-900 dark:bg-blue-950/30">
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-blue-700 dark:text-blue-300">
            Usulan Perubahan
          </h3>
          <dl className="space-y-1 text-sm text-zinc-700 dark:text-zinc-300">
            <div className="flex justify-between gap-2">
              <dt>Volume</dt>
              <dd>{applyPercent(revision.planned_volume, changes.volume_delta_percent)}</dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt>Intensitas</dt>
              <dd>{applyPercent(revision.planned_intensity, changes.intensity_delta_percent)}</dd>
            </div>
            {changes.session_type_swap && (
              <div className="flex justify-between gap-2">
                <dt>Jenis sesi</dt>
                <dd>
                  {changes.session_type_swap.from} &rarr; {changes.session_type_swap.to}
                </dd>
              </div>
            )}
          </dl>
          <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-300">{changes.rationale}</p>
        </div>
      </div>

      {revision.source_citations.length > 0 && (
        <div className="mt-4">
          <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-zinc-500">
            Sitasi Sumber
          </h3>
          <ul className="space-y-1 text-sm">
            {revision.source_citations.map((citation) => (
              <li key={citation.guideline_id}>
                {citation.url ? (
                  <a
                    href={citation.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:underline dark:text-blue-400"
                  >
                    {citation.note ?? citation.url}
                  </a>
                ) : (
                  <span className="text-zinc-600 dark:text-zinc-300">{citation.note}</span>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      {editing ? (
        <EditForm
          revisionId={revision.id}
          initial={changes}
          onDone={() => {
            setEditing(false);
            router.refresh();
          }}
          onCancel={() => setEditing(false)}
        />
      ) : (
        <div className="mt-4 flex gap-3">
          <button
            type="button"
            onClick={() => handleAction("approve")}
            disabled={submitting !== null}
            className="rounded-md bg-green-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {submitting === "approve" ? "Menerapkan..." : "Approve"}
          </button>
          <button
            type="button"
            onClick={() => setEditing(true)}
            disabled={submitting !== null}
            className="rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 transition hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-900"
          >
            Edit
          </button>
          <button
            type="button"
            onClick={() => handleAction("reject")}
            disabled={submitting !== null}
            className="rounded-md border border-red-300 px-4 py-2 text-sm font-medium text-red-700 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-red-900 dark:text-red-400 dark:hover:bg-red-950"
          >
            {submitting === "reject" ? "Menolak..." : "Reject"}
          </button>
        </div>
      )}
    </div>
  );
}

type EditFieldState = {
  volumeDeltaPercent: string;
  intensityDeltaPercent: string;
  sessionTypeFrom: string;
  sessionTypeTo: string;
  rationale: string;
};

type EditFormErrors = Partial<Record<keyof EditFieldState | "_form", string[]>>;

function EditForm({
  revisionId,
  initial,
  onDone,
  onCancel,
}: {
  revisionId: number;
  initial: ProposedChanges;
  onDone: () => void;
  onCancel: () => void;
}) {
  const [form, setForm] = useState<EditFieldState>({
    volumeDeltaPercent: initial.volume_delta_percent != null ? String(initial.volume_delta_percent) : "",
    intensityDeltaPercent:
      initial.intensity_delta_percent != null ? String(initial.intensity_delta_percent) : "",
    sessionTypeFrom: initial.session_type_swap?.from ?? "",
    sessionTypeTo: initial.session_type_swap?.to ?? "",
    rationale: initial.rationale,
  });
  const [errors, setErrors] = useState<EditFormErrors>({});
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setErrors({});
    setSubmitting(true);

    try {
      const response = await fetch(`/api/revisions/${revisionId}/edit-approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          volumeDeltaPercent: form.volumeDeltaPercent || undefined,
          intensityDeltaPercent: form.intensityDeltaPercent || undefined,
          sessionTypeFrom: form.sessionTypeFrom || undefined,
          sessionTypeTo: form.sessionTypeTo || undefined,
          rationale: form.rationale,
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        setErrors(data.errors ?? { _form: [data.message ?? "Gagal menerapkan revisi."] });
        return;
      }
      onDone();
    } catch {
      setErrors({ _form: ["Tidak bisa terhubung ke server. Periksa koneksi internet Anda."] });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="mt-4 space-y-4 border-t border-zinc-200 pt-4 dark:border-zinc-800">
      {errors._form && (
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-300">
          {errors._form[0]}
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Perubahan Volume (%)" error={errors.volumeDeltaPercent?.[0]}>
          <input
            type="number"
            step="0.1"
            min={-30}
            max={30}
            value={form.volumeDeltaPercent}
            onChange={(e) => setForm((f) => ({ ...f, volumeDeltaPercent: e.target.value }))}
            className={inputClass(!!errors.volumeDeltaPercent)}
          />
        </Field>
        <Field label="Perubahan Intensitas (%)" error={errors.intensityDeltaPercent?.[0]}>
          <input
            type="number"
            step="0.1"
            min={-30}
            max={30}
            value={form.intensityDeltaPercent}
            onChange={(e) => setForm((f) => ({ ...f, intensityDeltaPercent: e.target.value }))}
            className={inputClass(!!errors.intensityDeltaPercent)}
          />
        </Field>
        <Field label="Ganti Jenis Sesi Dari (opsional)" error={errors.sessionTypeFrom?.[0]}>
          <input
            type="text"
            value={form.sessionTypeFrom}
            onChange={(e) => setForm((f) => ({ ...f, sessionTypeFrom: e.target.value }))}
            className={inputClass(!!errors.sessionTypeFrom)}
          />
        </Field>
        <Field label="Menjadi (opsional)" error={errors.sessionTypeTo?.[0]}>
          <input
            type="text"
            value={form.sessionTypeTo}
            onChange={(e) => setForm((f) => ({ ...f, sessionTypeTo: e.target.value }))}
            className={inputClass(!!errors.sessionTypeTo)}
          />
        </Field>
      </div>

      <Field label="Alasan" error={errors.rationale?.[0]}>
        <textarea
          value={form.rationale}
          onChange={(e) => setForm((f) => ({ ...f, rationale: e.target.value }))}
          className={inputClass(!!errors.rationale)}
          rows={2}
        />
      </Field>

      <p className="text-xs text-zinc-500">
        Perubahan hanya diterapkan ke sesi terjadwal mulai hari ini -- sesi yang sudah lewat tidak
        diubah.
      </p>

      <div className="flex gap-3">
        <button
          type="submit"
          disabled={submitting}
          className="rounded-md bg-green-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {submitting ? "Menerapkan..." : "Terapkan Perubahan"}
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
