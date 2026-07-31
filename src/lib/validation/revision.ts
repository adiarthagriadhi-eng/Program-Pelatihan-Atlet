import { z } from "zod";

function optionalPercent(message: string) {
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
      if (num < -30 || num > 30) {
        ctx.addIssue({ code: "custom", message: "Nilai dibatasi -30 sampai 30 persen" });
        return z.NEVER;
      }
      return num;
    });
}

export const revisionEditSchema = z.object({
  volumeDeltaPercent: optionalPercent("Perubahan volume harus berupa angka"),
  intensityDeltaPercent: optionalPercent("Perubahan intensitas harus berupa angka"),
  sessionTypeFrom: z
    .string()
    .trim()
    .max(100)
    .optional()
    .transform((val) => (val && val.trim() !== "" ? val : null)),
  sessionTypeTo: z
    .string()
    .trim()
    .max(100)
    .optional()
    .transform((val) => (val && val.trim() !== "" ? val : null)),
  rationale: z
    .string({ error: "Alasan wajib diisi" })
    .trim()
    .min(1, "Alasan wajib diisi")
    .max(1000, "Alasan maksimal 1000 karakter"),
});

export type RevisionEditValues = z.infer<typeof revisionEditSchema>;
