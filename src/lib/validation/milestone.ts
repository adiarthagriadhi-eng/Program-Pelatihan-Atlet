import { z } from "zod";
import { MILESTONE_TYPES } from "@/lib/constants/milestone";

function isValidDate(value: string) {
  const date = new Date(value);
  return !Number.isNaN(date.getTime());
}

export const milestoneFormSchema = z.object({
  athleteId: z
    .string({ error: "Atlet wajib dipilih" })
    .min(1, "Atlet wajib dipilih")
    .transform((val, ctx) => {
      const num = Number(val);
      if (!Number.isInteger(num) || num <= 0) {
        ctx.addIssue({ code: "custom", message: "Atlet wajib dipilih" });
        return z.NEVER;
      }
      return num;
    }),
  targetDate: z
    .string({ error: "Tanggal target wajib diisi" })
    .min(1, "Tanggal target wajib diisi")
    .refine(isValidDate, "Tanggal target tidak valid"),
  milestoneType: z.enum(MILESTONE_TYPES, { error: "Jenis milestone wajib dipilih" }),
  description: z
    .string({ error: "Deskripsi wajib diisi" })
    .trim()
    .min(3, "Deskripsi minimal 3 karakter")
    .max(500, "Deskripsi maksimal 500 karakter"),
});

export type MilestoneFormValues = z.infer<typeof milestoneFormSchema>;
