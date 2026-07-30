"use client";

import { useState, type FormEvent, type ReactNode } from "react";
import { useRouter } from "next/navigation";

type Sport = { id: number; name: string };

type FormState = {
  name: string;
  sportId: string;
  birthDate: string;
  sex: string;
  trainingAgeYears: string;
};

type FormErrors = Partial<Record<keyof FormState | "_form", string[]>>;

const emptyForm: FormState = {
  name: "",
  sportId: "",
  birthDate: "",
  sex: "",
  trainingAgeYears: "",
};

export default function AthleteForm({ sports }: { sports: Sport[] }) {
  const router = useRouter();
  const [form, setForm] = useState<FormState>(emptyForm);
  const [errors, setErrors] = useState<FormErrors>({});
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  function validateClient(): FormErrors {
    const next: FormErrors = {};

    const name = form.name.trim();
    if (!name) next.name = ["Nama atlet wajib diisi"];
    else if (name.length < 2) next.name = ["Nama atlet minimal 2 karakter"];

    if (!form.sportId) next.sportId = ["Cabang olahraga wajib dipilih"];

    if (!form.birthDate) {
      next.birthDate = ["Tanggal lahir wajib diisi"];
    } else {
      const parsedDate = new Date(form.birthDate);
      if (Number.isNaN(parsedDate.getTime()) || parsedDate > new Date()) {
        next.birthDate = ["Tanggal lahir tidak valid"];
      }
    }

    if (!form.sex) next.sex = ["Jenis kelamin wajib dipilih"];

    if (!form.trainingAgeYears) {
      next.trainingAgeYears = ["Training age wajib diisi"];
    } else {
      const value = Number(form.trainingAgeYears);
      if (Number.isNaN(value)) {
        next.trainingAgeYears = ["Training age harus berupa angka (contoh: 2.5)"];
      } else if (value < 0) {
        next.trainingAgeYears = ["Training age tidak boleh negatif"];
      } else if (value > 50) {
        next.trainingAgeYears = ["Training age maksimal 50 tahun"];
      }
    }

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
      const response = await fetch("/api/athletes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name.trim(),
          sportId: form.sportId,
          birthDate: form.birthDate,
          sex: form.sex,
          trainingAgeYears: form.trainingAgeYears,
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
      setForm(emptyForm);
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
          Atlet berhasil ditambahkan.
        </div>
      )}

      {errors._form && (
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-300">
          {errors._form[0]}
        </div>
      )}

      <Field label="Nama Atlet" error={errors.name?.[0]}>
        <input
          type="text"
          value={form.name}
          onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
          className={inputClass(!!errors.name)}
          placeholder="Contoh: Ni Kadek Ayu"
        />
      </Field>

      <Field label="Cabang Olahraga" error={errors.sportId?.[0]}>
        <select
          value={form.sportId}
          onChange={(e) => setForm((f) => ({ ...f, sportId: e.target.value }))}
          className={inputClass(!!errors.sportId)}
        >
          <option value="">-- Pilih cabang olahraga --</option>
          {sports.map((sport) => (
            <option key={sport.id} value={sport.id}>
              {sport.name}
            </option>
          ))}
        </select>
        {sports.length === 0 && (
          <p className="mt-1 text-xs text-amber-600 dark:text-amber-400">
            Belum ada data cabang olahraga di tabel &quot;sports&quot;. Tambahkan dulu sebelum bisa
            memilih di sini.
          </p>
        )}
      </Field>

      <Field label="Tanggal Lahir" error={errors.birthDate?.[0]}>
        <input
          type="date"
          value={form.birthDate}
          onChange={(e) => setForm((f) => ({ ...f, birthDate: e.target.value }))}
          className={inputClass(!!errors.birthDate)}
        />
      </Field>

      <Field label="Jenis Kelamin" error={errors.sex?.[0]}>
        <select
          value={form.sex}
          onChange={(e) => setForm((f) => ({ ...f, sex: e.target.value }))}
          className={inputClass(!!errors.sex)}
        >
          <option value="">-- Pilih jenis kelamin --</option>
          <option value="Laki-laki">Laki-laki</option>
          <option value="Perempuan">Perempuan</option>
        </select>
      </Field>

      <Field
        label="Training Age (tahun latihan terstruktur)"
        error={errors.trainingAgeYears?.[0]}
        hint="Contoh: 2.5 untuk 2 tahun 6 bulan"
      >
        <input
          type="number"
          step="0.1"
          min="0"
          value={form.trainingAgeYears}
          onChange={(e) => setForm((f) => ({ ...f, trainingAgeYears: e.target.value }))}
          className={inputClass(!!errors.trainingAgeYears)}
          placeholder="Contoh: 2.5"
        />
      </Field>

      <button
        type="submit"
        disabled={submitting}
        className="w-full rounded-md bg-blue-600 py-2.5 font-medium text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {submitting ? "Menyimpan..." : "Simpan Atlet"}
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
  hint,
  children,
}: {
  label: string;
  error?: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <div>
      <label className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
        {label}
      </label>
      {children}
      {hint && !error && <p className="mt-1 text-xs text-zinc-500">{hint}</p>}
      {error && <p className="mt-1 text-xs text-red-600 dark:text-red-400">{error}</p>}
    </div>
  );
}
