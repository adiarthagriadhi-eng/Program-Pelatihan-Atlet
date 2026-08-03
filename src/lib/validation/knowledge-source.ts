import { z } from "zod";

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

export const knowledgeSourceFormSchema = z
  .object({
    sportId: positiveIntField("Cabang olahraga wajib dipilih"),
    title: z
      .string({ error: "Judul wajib diisi" })
      .trim()
      .min(2, "Judul minimal 2 karakter")
      .max(300, "Judul maksimal 300 karakter"),
    sourceUrl: z
      .string()
      .trim()
      .max(2000)
      .optional()
      .transform((val) => (val && val.trim() !== "" ? val : null)),
    uploadedContent: z
      .string()
      .trim()
      .max(20000, "Konten maksimal 20000 karakter")
      .optional()
      .transform((val) => (val && val.trim() !== "" ? val : null)),
  })
  .refine((data) => data.sourceUrl !== null || data.uploadedContent !== null, {
    message: "Isi minimal salah satu: URL sumber atau konten/catatan",
    path: ["uploadedContent"],
  });

export type KnowledgeSourceFormValues = z.infer<typeof knowledgeSourceFormSchema>;

export const knowledgeSourceSearchSchema = z.object({
  sportId: positiveIntField("Cabang olahraga wajib dipilih"),
  topicTag: z
    .string({ error: "Topik pencarian wajib diisi" })
    .trim()
    .min(2, "Topik minimal 2 karakter")
    .max(150, "Topik maksimal 150 karakter"),
});

export type KnowledgeSourceSearchValues = z.infer<typeof knowledgeSourceSearchSchema>;
