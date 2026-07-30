"use client";

import { useState, type FormEvent, type ReactNode } from "react";
import { useRouter } from "next/navigation";

type Athlete = { id: number; name: string };

type FormState = {
  athleteId: string;
  assessmentDate: string;
  sessionRpe: string;
  sessionDurationMinutes: string;
  sleepHours: string;
  sleepQuality: string;
  wellnessScore: string;
  muscleSoreness: string;
  mood: string;
  stress: string;
};

type FormErrors = Partial<Record<keyof FormState | "_form", string[]>>;

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function emptyForm(athleteId = ""): FormState {
  return {
    athleteId,
    assessmentDate: todayISO(),
    sessionRpe: "",
    sessionDurationMinutes: "",
    sleepHours: "",
    sleepQuality: "",
    wellnessScore: "",
    muscleSoreness: "",
    mood: "",
    stress: "",
  };
}

export default function AssessmentForm({ athletes }: { athletes: Athlete[] }) {
  const router = useRouter();
  const [form, setForm] = useState<FormState>(() => emptyForm());
  const [errors, setErrors] = useState<FormErrors>({});
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  function validateClient(): FormErrors {
    const next: FormErrors = {};

    if (!form.athleteId) next.athleteId = ["Atlet wajib dipilih"];

    if (!form.assessmentDate) {
      next.assessmentDate = ["Tanggal wajib diisi"];
    } else {
      const parsedDate = new Date(form.assessmentDate);
      const endOfToday = new Date();
      endOfToday.setHours(23, 59, 59, 999);
      if (Number.isNaN(parsedDate.getTime()) || parsedDate > endOfToday) {
        next.assessmentDate = ["Tanggal tidak boleh di masa depan"];
      }
    }

    if (!form.sessionRpe) next.sessionRpe = ["RPE sesi wajib diisi"];

    if (!form.sessionDurationMinutes) {
      next.sessionDurationMinutes = ["Durasi sesi wajib diisi"];
    } else {
      const value = Number(form.sessionDurationMinutes);
      if (!Number.isInteger(value) || value < 1 || value > 600) {
        next.sessionDurationMinutes = ["Durasi sesi harus angka bulat 1-600 menit"];
      }
    }

    if (!form.sleepHours) {
      next.sleepHours = ["Jam tidur wajib diisi"];
    } else {
      const value = Number(form.sleepHours);
      if (Number.isNaN(value) || value < 0 || value > 24) {
        next.sleepHours = ["Jam tidur harus angka antara 0-24"];
      }
    }

    if (!form.sleepQuality) next.sleepQuality = ["Kualitas tidur wajib dipilih"];
    if (!form.wellnessScore) next.wellnessScore = ["Wellness score wajib dipilih"];
    if (!form.muscleSoreness) next.muscleSoreness = ["Muscle soreness wajib dipilih"];
    if (!form.mood) next.mood = ["Mood wajib dipilih"];
    if (!form.stress) next.stress = ["Stress wajib dipilih"];

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
      const response = await fetch("/api/assessments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });

      const data = await response.json();

      if (!response.ok) {
        setErrors(
          data.errors ?? { _form: [data.message ?? "Gagal menyimpan data. Coba lagi."] }
        );
        return;
      }

      setSuccess(true);
      setForm(emptyForm(form.athleteId));
      router.refresh();
    } catch {
      setErrors({ _form: ["Tidak bisa terhubung ke server. Periksa koneksi internet Anda."] });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6" noValidate>
      {success && (
        <div className="rounded-md border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800 dark:border-green-900 dark:bg-green-950 dark:text-green-300">
          Assessment berhasil disimpan.
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

      <Field label="Tanggal" error={errors.assessmentDate?.[0]}>
        <input
          type="date"
          value={form.assessmentDate}
          onChange={(e) => setForm((f) => ({ ...f, assessmentDate: e.target.value }))}
          className={inputClass(!!errors.assessmentDate)}
        />
      </Field>

      <Field label="RPE Sesi (1 = sangat ringan, 10 = maksimal)" error={errors.sessionRpe?.[0]}>
        <ScalePicker
          value={form.sessionRpe}
          onChange={(value) => setForm((f) => ({ ...f, sessionRpe: value }))}
          min={1}
          max={10}
        />
      </Field>

      <Field label="Durasi Sesi (menit)" error={errors.sessionDurationMinutes?.[0]}>
        <input
          type="number"
          inputMode="numeric"
          step={5}
          min={0}
          value={form.sessionDurationMinutes}
          onChange={(e) => setForm((f) => ({ ...f, sessionDurationMinutes: e.target.value }))}
          className={inputClass(!!errors.sessionDurationMinutes)}
          placeholder="Contoh: 90"
        />
      </Field>

      <Field label="Jam Tidur (malam sebelumnya)" error={errors.sleepHours?.[0]}>
        <input
          type="number"
          inputMode="decimal"
          step={0.5}
          min={0}
          max={24}
          value={form.sleepHours}
          onChange={(e) => setForm((f) => ({ ...f, sleepHours: e.target.value }))}
          className={inputClass(!!errors.sleepHours)}
          placeholder="Contoh: 7.5"
        />
      </Field>

      <Field label="Kualitas Tidur (1 = buruk, 5 = sangat baik)" error={errors.sleepQuality?.[0]}>
        <ScalePicker
          value={form.sleepQuality}
          onChange={(value) => setForm((f) => ({ ...f, sleepQuality: value }))}
          min={1}
          max={5}
        />
      </Field>

      <Field label="Wellness Score (1 = buruk, 5 = sangat baik)" error={errors.wellnessScore?.[0]}>
        <ScalePicker
          value={form.wellnessScore}
          onChange={(value) => setForm((f) => ({ ...f, wellnessScore: value }))}
          min={1}
          max={5}
        />
      </Field>

      <Field
        label="Muscle Soreness / Nyeri Otot (1 = tidak nyeri, 5 = sangat nyeri)"
        error={errors.muscleSoreness?.[0]}
      >
        <ScalePicker
          value={form.muscleSoreness}
          onChange={(value) => setForm((f) => ({ ...f, muscleSoreness: value }))}
          min={1}
          max={5}
        />
      </Field>

      <Field label="Mood (1 = buruk, 5 = sangat baik)" error={errors.mood?.[0]}>
        <ScalePicker
          value={form.mood}
          onChange={(value) => setForm((f) => ({ ...f, mood: value }))}
          min={1}
          max={5}
        />
      </Field>

      <Field label="Stress (1 = sangat stress, 5 = sangat tenang)" error={errors.stress?.[0]}>
        <ScalePicker
          value={form.stress}
          onChange={(value) => setForm((f) => ({ ...f, stress: value }))}
          min={1}
          max={5}
        />
      </Field>

      <button
        type="submit"
        disabled={submitting}
        className="w-full rounded-md bg-blue-600 py-2.5 font-medium text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {submitting ? "Menyimpan..." : "Simpan"}
      </button>
    </form>
  );
}

function ScalePicker({
  value,
  onChange,
  min,
  max,
}: {
  value: string;
  onChange: (value: string) => void;
  min: number;
  max: number;
}) {
  const options = Array.from({ length: max - min + 1 }, (_, i) => min + i);

  return (
    <div className="grid grid-cols-5 gap-2">
      {options.map((n) => {
        const selected = value === String(n);
        return (
          <button
            key={n}
            type="button"
            onClick={() => onChange(String(n))}
            className={[
              "rounded-md border py-2 text-sm font-medium transition",
              selected
                ? "border-blue-600 bg-blue-600 text-white"
                : "border-zinc-300 text-zinc-700 hover:border-blue-400 dark:border-zinc-700 dark:text-zinc-200",
            ].join(" ")}
          >
            {n}
          </button>
        );
      })}
    </div>
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
