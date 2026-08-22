import { z } from "zod";

function isValidPastDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return false;
  return date <= new Date();
}

function optionalPositiveNumber(fieldLabel: string, max: number) {
  return z
    .string()
    .optional()
    .transform((val, ctx) => {
      if (!val || val.trim() === "") return null;
      const num = Number(val);
      if (!Number.isFinite(num) || num <= 0) {
        ctx.addIssue({ code: "custom", message: `${fieldLabel} harus berupa angka positif` });
        return z.NEVER;
      }
      if (num > max) {
        ctx.addIssue({ code: "custom", message: `${fieldLabel} maksimal ${max}` });
        return z.NEVER;
      }
      return num;
    });
}

export const athleteFormSchema = z.object({
  name: z
    .string({ error: "Nama atlet wajib diisi" })
    .trim()
    .min(2, "Nama atlet minimal 2 karakter")
    .max(150, "Nama atlet maksimal 150 karakter"),
  sportId: z
    .string({ error: "Cabang olahraga wajib dipilih" })
    .min(1, "Cabang olahraga wajib dipilih")
    .transform((val, ctx) => {
      const num = Number(val);
      if (!Number.isInteger(num) || num <= 0) {
        ctx.addIssue({ code: "custom", message: "Cabang olahraga wajib dipilih" });
        return z.NEVER;
      }
      return num;
    }),
  birthDate: z
    .string({ error: "Tanggal lahir wajib diisi" })
    .min(1, "Tanggal lahir wajib diisi")
    .refine(isValidPastDate, "Tanggal lahir tidak valid"),
  sex: z.enum(["Laki-laki", "Perempuan"], { error: "Jenis kelamin wajib dipilih" }),
  trainingAgeYears: z
    .string({ error: "Training age wajib diisi" })
    .min(1, "Training age wajib diisi")
    .transform((val, ctx) => {
      const num = Number(val);
      if (Number.isNaN(num)) {
        ctx.addIssue({
          code: "custom",
          message: "Training age harus berupa angka (contoh: 2.5)",
        });
        return z.NEVER;
      }
      if (num < 0) {
        ctx.addIssue({ code: "custom", message: "Training age tidak boleh negatif" });
        return z.NEVER;
      }
      if (num > 50) {
        ctx.addIssue({ code: "custom", message: "Training age maksimal 50 tahun" });
        return z.NEVER;
      }
      return num;
    }),
  weightKg: optionalPositiveNumber("Berat badan", 300),
  heightCm: optionalPositiveNumber("Tinggi badan", 250),
  bodyFatPercent: z
    .string()
    .optional()
    .transform((val, ctx) => {
      if (!val || val.trim() === "") return null;
      const num = Number(val);
      if (!Number.isFinite(num) || num < 0 || num > 60) {
        ctx.addIssue({ code: "custom", message: "Body fat % harus antara 0-60" });
        return z.NEVER;
      }
      return num;
    }),
  disciplineCategory: z
    .string()
    .trim()
    .max(100, "Kategori/nomor maksimal 100 karakter")
    .optional()
    .transform((val) => (val && val.length > 0 ? val : null)),
  eventName: z
    .string()
    .trim()
    .max(150, "Event maksimal 150 karakter")
    .optional()
    .transform((val) => (val && val.length > 0 ? val : null)),
});

export type AthleteFormValues = z.infer<typeof athleteFormSchema>;
