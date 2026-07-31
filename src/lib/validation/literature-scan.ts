import { z } from "zod";

export const literatureScanRequestSchema = z.object({
  topicTag: z
    .string({ error: "Topic tag wajib diisi" })
    .trim()
    .min(2, "Topic tag minimal 2 karakter")
    .max(150, "Topic tag maksimal 150 karakter"),
  programContext: z.string().trim().max(2000).optional(),
  athleteId: z.number().int().positive().optional(),
});

export type LiteratureScanRequest = z.infer<typeof literatureScanRequestSchema>;
