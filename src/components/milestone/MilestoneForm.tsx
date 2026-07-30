"use client";

import { useState, type FormEvent, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { MILESTONE_TYPES, MILESTONE_TYPE_LABELS } from "@/lib/constants/milestone";

type Athlete = { id: number; name: string };

type FormState = {
  athleteId: string;
  targetDate: string;
  milestoneType: string;
  description: string;
};

type FormErrors = Partial<Record<keyof FormState | "_form", string[]>>;

function emptyForm(): FormState {
  return {
    athleteId: "",
    targetDate: "",
    milestoneType: "",
    description: "",
  };
}

export default function MilestoneForm({ athletes }: { athletes: Athlete[] }) {
  const router = useRouter();
  const [form, setForm] = useState<FormState>(emptyForm);
  const [errors, setErrors] = useState<FormErrors>({});
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  function validateClient(): FormErrors {
    const next: FormErrors = {};

    if (!form.athleteId) next.athleteId = ["Atlet wajib dipilih"];

    if (!form.targetDate) {
      next.targetDate = ["Tanggal target wajib diisi"];
    } else if (Number.isNaN(new Date(form.targetDate).getTime())) {
      next.targetDate = ["Tanggal target tidak valid"];
    }

    if (!form.milestoneType) next.milestoneType = ["Jenis milestone wajib dipilih"];

    const description = form.description.trim();
    if (!description) next.description = ["Deskripsi wajib diisi"];
    else if (description.length < 3) next.description = ["Deskripsi minimal 3 karakter"];

    return next;
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setSuccess(false);

    const clientErrors = validateClient();
    if (Object.keys(clientErrors).length > 0) {
      setErrors(clientErrors);
      return;
    }

    setErrors({});
    setSubmitting(true);

    try {
      const response = await fetch("/api/milestones", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          description: form.description.trim(),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setErrors(
          data.errors ?? { _form: [data.message ?? "Gagal menyimpan data. Coba lagi."] }
        );
        return;
      }

      setSuccess(true);
      setForm(emptyForm());
      router.refresh();
    } catch {
      setErrors({ _form: ["Tidak bisa terhubung ke server. Periksa koneksi internet Anda."] });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5" noValidate>
      {success && (
        <div className="rounded-md border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800 dark:border-green-900 dark:bg-green-950 dark:text-green-300">
          Milestone berhasil ditambahkan.
        </div>
      )}

      {errors._form && (
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-300">
          {errors._form[0]}
        </div>
      )}

      <Field label="Atlet" error={errors.athleteId?.[0]}>
        <select
          value={form.athleteId}
          onChange={(e) => setForm((f) => ({ ...f, athleteId: e.target.value }))}
          className={inputClass(!!errors.athleteId)}
        >
          <option value="">-- Pilih atlet --</option>
          {athletes.map((athlete) => (
            <option key={athlete.id} value={athlete.id}>
              {athlete.name}
            </option>
          ))}
        </select>
        {athletes.length === 0 && (
          <p className="mt-1 text-xs text-amber-600 dark:text-amber-400">
            Belum ada atlet terdaftar. Tambahkan lewat halaman &quot;Tambah Atlet Baru&quot; dulu.
          </p>
        )}
      </Field>

      <Field label="Tanggal Target" error={errors.targetDate?.[0]}>
        <input
          type="date"
          value={form.targetDate}
          onChange={(e) => setForm((f) => ({ ...f, targetDate: e.target.value }))}
          className={inputClass(!!errors.targetDate)}
        />
      </Field>

      <Field label="Jenis Milestone" error={errors.milestoneType?.[0]}>
        <select
          value={form.milestoneType}
          onChange={(e) => setForm((f) => ({ ...f, milestoneType: e.target.value }))}
          className={inputClass(!!errors.milestoneType)}
        >
          <option value="">-- Pilih jenis milestone --</option>
          {MILESTONE_TYPES.map((type) => (
            <option key={type} value={type}>
              {MILESTONE_TYPE_LABELS[type]}
            </option>
          ))}
        </select>
      </Field>

      <Field label="Deskripsi Singkat" error={errors.description?.[0]}>
        <textarea
          value={form.description}
          onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
          className={inputClass(!!errors.description)}
          rows={3}
          placeholder="Contoh: Kejuaraan Provinsi Bali, kategori 100m putri"
        />
      </Field>

      <button
        type="submit"
        disabled={submitting}
        className="w-full rounded-md bg-blue-600 py-2.5 font-medium text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {submitting ? "Menyimpan..." : "Simpan Milestone"}
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
