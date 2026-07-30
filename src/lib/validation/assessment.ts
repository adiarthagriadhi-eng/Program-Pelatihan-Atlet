import { z } from "zod";

function isNotFutureDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return false;
  const endOfToday = new Date();
  endOfToday.setHours(23, 59, 59, 999);
  return date <= endOfToday;
}

function numericField(requiredMessage: string) {
  return z.string({ error: requiredMessage }).min(1, requiredMessage);
}

function scaleField(requiredMessage: string, rangeMessage: string) {
  return numericField(requiredMessage).transform((val, ctx) => {
    const num = Number(val);
    if (!Number.isInteger(num) || num < 1 || num > 5) {
      ctx.addIssue({ code: "custom", message: rangeMessage });
      return z.NEVER;
    }
    return num;
  });
}

export const dailyAssessmentSchema = z.object({
  athleteId: numericField("Atlet wajib dipilih").transform((val, ctx) => {
    const num = Number(val);
    if (!Number.isInteger(num) || num <= 0) {
      ctx.addIssue({ code: "custom", message: "Atlet wajib dipilih" });
      return z.NEVER;
    }
    return num;
  }),
  assessmentDate: z
    .string({ error: "Tanggal wajib diisi" })
    .min(1, "Tanggal wajib diisi")
    .refine(isNotFutureDate, "Tanggal tidak boleh di masa depan"),
  sessionRpe: numericField("RPE sesi wajib diisi").transform((val, ctx) => {
    const num = Number(val);
    if (Number.isNaN(num)) {
      ctx.addIssue({ code: "custom", message: "RPE sesi harus berupa angka" });
      return z.NEVER;
    }
    if (num < 1 || num > 10) {
      ctx.addIssue({ code: "custom", message: "RPE sesi harus antara 1-10" });
      return z.NEVER;
    }
    return num;
  }),
  sessionDurationMinutes: numericField("Durasi sesi wajib diisi").transform((val, ctx) => {
    const num = Number(val);
    if (!Number.isInteger(num)) {
      ctx.addIssue({ code: "custom", message: "Durasi sesi harus berupa angka bulat (menit)" });
      return z.NEVER;
    }
    if (num < 1 || num > 600) {
      ctx.addIssue({ code: "custom", message: "Durasi sesi harus antara 1-600 menit" });
      return z.NEVER;
    }
    return num;
  }),
  sleepHours: numericField("Jam tidur wajib diisi").transform((val, ctx) => {
    const num = Number(val);
    if (Number.isNaN(num)) {
      ctx.addIssue({ code: "custom", message: "Jam tidur harus berupa angka" });
      return z.NEVER;
    }
    if (num < 0 || num > 24) {
      ctx.addIssue({ code: "custom", message: "Jam tidur harus antara 0-24 jam" });
      return z.NEVER;
    }
    return num;
  }),
  sleepQuality: scaleField(
    "Kualitas tidur wajib dipilih",
    "Kualitas tidur harus antara 1-5"
  ),
  wellnessScore: scaleField("Wellness score wajib dipilih", "Wellness score harus antara 1-5"),
  muscleSoreness: scaleField(
    "Muscle soreness wajib dipilih",
    "Muscle soreness harus antara 1-5"
  ),
  mood: scaleField("Mood wajib dipilih", "Mood harus antara 1-5"),
  stress: scaleField("Stress wajib dipilih", "Stress harus antara 1-5"),
});

export type DailyAssessmentValues = z.infer<typeof dailyAssessmentSchema>;
