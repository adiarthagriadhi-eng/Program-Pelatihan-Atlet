import { z } from "zod";

function isValidDate(value: string) {
  const date = new Date(value);
  return !Number.isNaN(date.getTime());
}

function toPositiveInt(value: string, ctx: z.RefinementCtx, message: string) {
  const num = Number(value);
  if (!Number.isInteger(num) || num <= 0) {
    ctx.addIssue({ code: "custom", message });
    return z.NEVER;
  }
  return num;
}

export const programFormSchema = z
  .object({
    athleteId: z
      .string({ error: "Atlet wajib dipilih" })
      .min(1, "Atlet wajib dipilih")
      .transform((val, ctx) => toPositiveInt(val, ctx, "Atlet wajib dipilih")),
    startDate: z
      .string({ error: "Tanggal mulai wajib diisi" })
      .min(1, "Tanggal mulai wajib diisi")
      .refine(isValidDate, "Tanggal mulai tidak valid"),
    endDate: z
      .string()
      .optional()
      .transform((val) => (val && val.trim() !== "" ? val : undefined))
      .refine((val) => val === undefined || isValidDate(val), "Tanggal selesai tidak valid"),
    macrocycleGoal: z
      .string()
      .trim()
      .max(1000, "Tujuan makrosiklus maksimal 1000 karakter")
      .optional()
      .transform((val) => (val && val.trim() !== "" ? val : null)),
  })
  .refine(
    (data) => data.endDate === undefined || new Date(data.endDate) >= new Date(data.startDate),
    { message: "Tanggal selesai tidak boleh sebelum tanggal mulai", path: ["endDate"] }
  );

export type ProgramFormValues = z.infer<typeof programFormSchema>;
