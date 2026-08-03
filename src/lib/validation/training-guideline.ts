import { z } from "zod";
import { PHASE_TYPES } from "@/lib/constants/phase";

function positiveIntField(requiredMessage: string) {
  return z
    .string({ error: requiredMessage })
    .min(1, requiredMessage)
    .transform((val, ctx) => {
      const num = Number(val);
      if (!Number.isInteger(num) || num <= 0) {
        ctx.addIssue({ code: "custom", message: requiredMessage });
        return z.NEVER;
      }
      return num;
    });
}

export const trainingGuidelineFormSchema = z.object({
  sportId: positiveIntField("Cabang olahraga wajib dipilih"),
  sourceId: positiveIntField("Sumber wajib dipilih"),
  applicablePhaseType: z
    .enum(PHASE_TYPES)
    .optional()
    .or(z.literal(""))
    .transform((val) => (val ? val : null)),
  topic: z
    .string()
    .trim()
    .max(150, "Topik maksimal 150 karakter")
    .optional()
    .transform((val) => (val && val.trim() !== "" ? val : null)),
  guidelineText: z
    .string({ error: "Kaidah wajib diisi" })
    .trim()
    .min(5, "Kaidah minimal 5 karakter")
    .max(4000, "Kaidah maksimal 4000 karakter"),
});

export type TrainingGuidelineFormValues = z.infer<typeof trainingGuidelineFormSchema>;

export const trainingGuidelineEditSchema = trainingGuidelineFormSchema.pick({
  applicablePhaseType: true,
  topic: true,
  guidelineText: true,
});

export type TrainingGuidelineEditValues = z.infer<typeof trainingGuidelineEditSchema>;
