"use client";

import { useState, type FormEvent, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { PHASE_TYPES, PHASE_TYPE_LABELS, type PhaseType } from "@/lib/constants/phase";

export type PhaseRow = {
  id: number;
  program_id: number;
  phase_type: PhaseType;
  week_number: number | null;
  start_date: string;
  end_date: string;
  primary_focus: string | null;
  planned_volume: string | null;
  planned_intensity: string | null;
  target_load_index: string | null;
};

type FieldState = {
  phaseType: string;
  weekNumber: string;
  startDate: string;
  endDate: string;
  primaryFocus: string;
  plannedVolume: string;
  plannedIntensity: string;
  targetLoadIndex: string;
};

type FormErrors = Partial<Record<keyof FieldState | "_form", string[]>>;

function emptyFields(): FieldState {
  return {
    phaseType: "",
    weekNumber: "",
    startDate: "",
    endDate: "",
    primaryFocus: "",
    plannedVolume: "",
    plannedIntensity: "",
    targetLoadIndex: "",
  };
}

function fieldsFromPhase(phase: PhaseRow): FieldState {
  return {
    phaseType: phase.phase_type,
    weekNumber: phase.week_number != null ? String(phase.week_number) : "",
    startDate: phase.start_date.slice(0, 10),
    endDate: phase.end_date.slice(0, 10),
    primaryFocus: phase.primary_focus ?? "",
    plannedVolume: phase.planned_volume ?? "",
    plannedIntensity: phase.planned_intensity ?? "",
    targetLoadIndex: phase.target_load_index ?? "",
  };
}

function formatDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" });
}

export default function PhaseTimeline({
  programId,
  phases,
}: {
  programId: number;
  phases: PhaseRow[];
}) {
  const [editingId, setEditingId] = useState<number | null>(null);
  const [adding, setAdding] = useState(false);

  const sorted = [...phases].sort(
    (a, b) => new Date(a.start_date).getTime() - new Date(b.start_date).getTime()
  );

  return (
    <div className="space-y-4">
      {sorted.length === 0 && !adding && (
        <div className="rounded-md border border-zinc-200 bg-zinc-50 px-4 py-6 text-center text-sm text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900">
          Belum ada fase di timeline. Tambahkan fase pertama (biasanya Persiapan Umum).
        </div>
      )}

      <ol className="space-y-3">
        {sorted.map((phase) => (
          <li
            key={phase.id}
            className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-800"
          >
            {editingId === phase.id ? (
              <PhaseForm
                programId={programId}
                phaseId={phase.id}
                initial={fieldsFromPhase(phase)}
                onDone={() => setEditingId(null)}
                onCancel={() => setEditingId(null)}
              />
            ) : (
              <PhaseCard phase={phase} onEdit={() => setEditingId(phase.id)} />
            )}
          </li>
        ))}
      </ol>

      {adding ? (
        <div className="rounded-lg border border-blue-200 p-4 dark:border-blue-900">
          <PhaseForm
            programId={programId}
            initial={emptyFields()}
            onDone={() => setAdding(false)}
            onCancel={() => setAdding(false)}
          />
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setAdding(true)}
          className="w-full rounded-md border border-dashed border-zinc-300 py-2.5 text-sm font-medium text-zinc-600 transition hover:border-blue-300 hover:text-blue-600 dark:border-zinc-700 dark:text-zinc-300 dark:hover:border-blue-800"
        >
          + Tambah Fase
        </button>
      )}
    </div>
  );
}

function PhaseCard({ phase, onEdit }: { phase: PhaseRow; onEdit: () => void }) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div>
        <div className="flex items-center gap-2">
          <span className="inline-block rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-medium text-blue-700 dark:bg-blue-950 dark:text-blue-300">
            {PHASE_TYPE_LABELS[phase.phase_type]}
          </span>
          {phase.week_number != null && (
            <span className="text-xs text-zinc-500">Minggu {phase.week_number}</span>
          )}
        </div>
        <p className="mt-1 text-sm font-medium text-zinc-900 dark:text-zinc-50">
          {formatDate(phase.start_date)} &ndash; {formatDate(phase.end_date)}
        </p>
        {phase.primary_focus && (
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-300">{phase.primary_focus}</p>
        )}
        <dl className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-zinc-500">
          {phase.planned_volume != null && (
            <div className="flex gap-1">
              <dt>Volume:</dt>
              <dd>{phase.planned_volume}</dd>
            </div>
          )}
          {phase.planned_intensity != null && (
            <div className="flex gap-1">
              <dt>Intensitas:</dt>
              <dd>{phase.planned_intensity}</dd>
            </div>
          )}
          {phase.target_load_index != null && (
            <div className="flex gap-1">
              <dt>Target load index:</dt>
              <dd>{phase.target_load_index}</dd>
            </div>
          )}
        </dl>
      </div>
      <button
        type="button"
        onClick={onEdit}
        className="shrink-0 rounded-md border border-zinc-300 px-3 py-1.5 text-xs font-medium text-zinc-700 transition hover:border-blue-300 hover:text-blue-600 dark:border-zinc-700 dark:text-zinc-300 dark:hover:border-blue-800"
      >
        Edit
      </button>
    </div>
  );
}

function PhaseForm({
  programId,
  phaseId,
  initial,
  onDone,
  onCancel,
}: {
  programId: number;
  phaseId?: number;
  initial: FieldState;
  onDone: () => void;
  onCancel: () => void;
}) {
  const router = useRouter();
  const [form, setForm] = useState<FieldState>(initial);
  const [errors, setErrors] = useState<FormErrors>({});
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setErrors({});
    setSubmitting(true);

    const payload = {
      programId: String(programId),
      phaseType: form.phaseType,
      weekNumber: form.weekNumber || undefined,
      startDate: form.startDate,
      endDate: form.endDate,
      primaryFocus: form.primaryFocus || undefined,
      plannedVolume: form.plannedVolume || undefined,
      plannedIntensity: form.plannedIntensity || undefined,
      targetLoadIndex: form.targetLoadIndex || undefined,
    };

    try {
      const response = await fetch(
        phaseId ? `/api/phases/${phaseId}` : "/api/phases",
        {
          method: phaseId ? "PUT" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        setErrors(
          data.errors ?? { _form: [data.message ?? "Gagal menyimpan fase. Coba lagi."] }
        );
        return;
      }

      router.refresh();
      onDone();
    } catch {
      setErrors({ _form: ["Tidak bisa terhubung ke server. Periksa koneksi internet Anda."] });
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
        <Field label="Jenis Fase" error={errors.phaseType?.[0]}>
          <select
            value={form.phaseType}
            onChange={(e) => setForm((f) => ({ ...f, phaseType: e.target.value }))}
            className={inputClass(!!errors.phaseType)}
          >
            <option value="">-- Pilih jenis fase --</option>
            {PHASE_TYPES.map((type) => (
              <option key={type} value={type}>
                {PHASE_TYPE_LABELS[type]}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Nomor Minggu (opsional)" error={errors.weekNumber?.[0]}>
          <input
            type="number"
            value={form.weekNumber}
            onChange={(e) => setForm((f) => ({ ...f, weekNumber: e.target.value }))}
            className={inputClass(!!errors.weekNumber)}
          />
        </Field>
        <Field label="Tanggal Mulai" error={errors.startDate?.[0]}>
          <input
            type="date"
            value={form.startDate}
            onChange={(e) => setForm((f) => ({ ...f, startDate: e.target.value }))}
            className={inputClass(!!errors.startDate)}
          />
        </Field>
        <Field label="Tanggal Selesai" error={errors.endDate?.[0]}>
          <input
            type="date"
            value={form.endDate}
            onChange={(e) => setForm((f) => ({ ...f, endDate: e.target.value }))}
            className={inputClass(!!errors.endDate)}
          />
        </Field>
        <Field label="Volume Rencana (opsional)" error={errors.plannedVolume?.[0]}>
          <input
            type="number"
            step="0.01"
            value={form.plannedVolume}
            onChange={(e) => setForm((f) => ({ ...f, plannedVolume: e.target.value }))}
            className={inputClass(!!errors.plannedVolume)}
          />
        </Field>
        <Field label="Intensitas Rencana (opsional)" error={errors.plannedIntensity?.[0]}>
          <input
            type="number"
            step="0.01"
            value={form.plannedIntensity}
            onChange={(e) => setForm((f) => ({ ...f, plannedIntensity: e.target.value }))}
            className={inputClass(!!errors.plannedIntensity)}
          />
        </Field>
        <Field label="Target Load Index (opsional)" error={errors.targetLoadIndex?.[0]}>
          <input
            type="number"
            step="0.01"
            value={form.targetLoadIndex}
            onChange={(e) => setForm((f) => ({ ...f, targetLoadIndex: e.target.value }))}
            className={inputClass(!!errors.targetLoadIndex)}
          />
        </Field>
      </div>

      <Field label="Fokus Utama (opsional)" error={errors.primaryFocus?.[0]}>
        <textarea
          value={form.primaryFocus}
          onChange={(e) => setForm((f) => ({ ...f, primaryFocus: e.target.value }))}
          className={inputClass(!!errors.primaryFocus)}
          rows={2}
          placeholder="Contoh: Membangun basis aerobik & kekuatan umum"
        />
      </Field>

      <div className="flex gap-3">
        <button
          type="submit"
          disabled={submitting}
          className="flex-1 rounded-md bg-blue-600 py-2 text-sm font-medium text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {submitting ? "Menyimpan..." : phaseId ? "Simpan Perubahan" : "Tambah Fase"}
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
