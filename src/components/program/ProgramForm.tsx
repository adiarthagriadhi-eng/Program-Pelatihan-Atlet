"use client";

import { useState, type FormEvent, type ReactNode } from "react";
import { useRouter } from "next/navigation";

type FormState = {
  startDate: string;
  endDate: string;
  macrocycleGoal: string;
};

type FormErrors = Partial<Record<keyof FormState | "_form", string[]>>;

export default function ProgramForm({ athleteId }: { athleteId: number }) {
  const router = useRouter();
  const [form, setForm] = useState<FormState>({
    startDate: "",
    endDate: "",
    macrocycleGoal: "",
  });
  const [errors, setErrors] = useState<FormErrors>({});
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();

    if (!form.startDate) {
      setErrors({ startDate: ["Tanggal mulai wajib diisi"] });
      return;
    }

    setErrors({});
    setSubmitting(true);

    try {
      const response = await fetch("/api/programs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          athleteId: String(athleteId),
          startDate: form.startDate,
          endDate: form.endDate || undefined,
          macrocycleGoal: form.macrocycleGoal.trim() || undefined,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setErrors(
          data.errors ?? { _form: [data.message ?? "Gagal menyimpan program. Coba lagi."] }
        );
        return;
      }

      router.refresh();
    } catch {
      setErrors({ _form: ["Tidak bisa terhubung ke server. Periksa koneksi internet Anda."] });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-5 rounded-lg border border-zinc-200 p-5 dark:border-zinc-800"
      noValidate
    >
      <div>
        <h2 className="font-medium text-zinc-900 dark:text-zinc-50">Belum ada program aktif</h2>
        <p className="mt-1 text-sm text-zinc-500">
          Buat program (makrosiklus) baru untuk atlet ini sebelum menyusun timeline periodisasi.
        </p>
      </div>

      {errors._form && (
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-300">
          {errors._form[0]}
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Tanggal Mulai" error={errors.startDate?.[0]}>
          <input
            type="date"
            value={form.startDate}
            onChange={(e) => setForm((f) => ({ ...f, startDate: e.target.value }))}
            className={inputClass(!!errors.startDate)}
          />
        </Field>
        <Field label="Tanggal Selesai (opsional)" error={errors.endDate?.[0]}>
          <input
            type="date"
            value={form.endDate}
            onChange={(e) => setForm((f) => ({ ...f, endDate: e.target.value }))}
            className={inputClass(!!errors.endDate)}
          />
        </Field>
      </div>

      <Field label="Tujuan Makrosiklus (opsional)" error={errors.macrocycleGoal?.[0]}>
        <textarea
          value={form.macrocycleGoal}
          onChange={(e) => setForm((f) => ({ ...f, macrocycleGoal: e.target.value }))}
          className={inputClass(!!errors.macrocycleGoal)}
          rows={2}
          placeholder="Contoh: Puncak performa di PON 2028"
        />
      </Field>

      <button
        type="submit"
        disabled={submitting}
        className="w-full rounded-md bg-blue-600 py-2.5 font-medium text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {submitting ? "Menyimpan..." : "Buat Program"}
      </button>
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
