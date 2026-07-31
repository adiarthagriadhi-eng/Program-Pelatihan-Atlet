import { z } from "zod";
import { PHASE_TYPES } from "@/lib/constants/phase";

function isValidDate(value: string) {
  const date = new Date(value);
  return !Number.isNaN(date.getTime());
}

function optionalNumber(message: string) {
  return z
    .string()
    .optional()
    .transform((val, ctx) => {
      if (!val || val.trim() === "") return null;
      const num = Number(val);
      if (Number.isNaN(num)) {
        ctx.addIssue({ code: "custom", message });
        return z.NEVER;
      }
      return num;
    });
}

export const phaseFormSchema = z
  .object({
    programId: z
      .string({ error: "Program wajib ditentukan" })
      .min(1, "Program wajib ditentukan")
      .transform((val, ctx) => {
        const num = Number(val);
        if (!Number.isInteger(num) || num <= 0) {
          ctx.addIssue({ code: "custom", message: "Program wajib ditentukan" });
          return z.NEVER;
        }
        return num;
      }),
    phaseType: z.enum(PHASE_TYPES, { error: "Jenis fase wajib dipilih" }),
    weekNumber: optionalNumber("Nomor minggu harus berupa angka"),
    startDate: z
      .string({ error: "Tanggal mulai wajib diisi" })
      .min(1, "Tanggal mulai wajib diisi")
      .refine(isValidDate, "Tanggal mulai tidak valid"),
    endDate: z
      .string({ error: "Tanggal selesai wajib diisi" })
      .min(1, "Tanggal selesai wajib diisi")
      .refine(isValidDate, "Tanggal selesai tidak valid"),
    primaryFocus: z
      .string()
      .trim()
      .max(500, "Fokus utama maksimal 500 karakter")
      .optional()
      .transform((val) => (val && val.trim() !== "" ? val : null)),
    plannedVolume: optionalNumber("Volume rencana harus berupa angka"),
    plannedIntensity: optionalNumber("Intensitas rencana harus berupa angka"),
    targetLoadIndex: optionalNumber("Target load index harus berupa angka"),
  })
  .refine((data) => new Date(data.endDate) >= new Date(data.startDate), {
    message: "Tanggal selesai tidak boleh sebelum tanggal mulai",
    path: ["endDate"],
  });

export type PhaseFormValues = z.infer<typeof phaseFormSchema>;
