import { z } from "zod";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { getAnthropicClient } from "@/lib/anthropic";

const literatureFindingSchema = z.object({
  source_title: z.string(),
  source_url: z.string(),
  summary: z.string(),
  relevance_score: z.number().min(0).max(1),
  caution_note: z.string().nullable(),
});

const literatureScanOutputSchema = z.object({
  findings: z.array(literatureFindingSchema),
});

export type LiteratureFinding = z.infer<typeof literatureFindingSchema>;

// System prompt disertakan PERSIS seperti yang diberikan -- hanya dua
// placeholder ({topic_tag} dan ringkasan konteks program) yang diisi.
function buildSystemPrompt(topicTag: string, programContext: string): string {
  return `Anda adalah asisten riset untuk ilmu keolahragaan (sport science).
Tugas Anda: cari temuan penelitian TERBARU dan KREDIBEL yang relevan
dengan topic_tag yang diberikan.

Topic tag: ${topicTag}
Konteks program: ${programContext}

Aturan:
1. Prioritaskan jurnal peer-reviewed, meta-analisis, dan sumber institusi
   resmi (universitas, badan olahraga nasional/internasional). Hindari
   blog non-ilmiah, forum, atau situs tanpa kredensial jelas.
2. Untuk tiap temuan, berikan RINGKASAN dalam kata-kata sendiri
   (parafrase) -- JANGAN kutip langsung lebih dari beberapa kata.
3. Beri relevance_score 0.00-1.00 berdasarkan seberapa langsung temuan
   ini berlaku ke konteks program yang diberikan (bukan skor popularitas
   sumber).
4. Jika sampel penelitian kecil (n<30) atau desainnya lemah, catat itu
   di summary sebagai catatan kehati-hatian, JANGAN sembunyikan.
5. Jika tidak ada temuan yang benar-benar relevan, kembalikan array
   kosong -- JANGAN memaksakan temuan yang tidak related.

Kembalikan HANYA dalam format JSON berikut, tanpa teks tambahan apapun:

{
  "findings": [
    {
      "source_title": "...",
      "source_url": "...",
      "summary": "... (2-3 kalimat, parafrase)",
      "relevance_score": 0.00,
      "caution_note": "... (isi jika ada keterbatasan studi, atau null)"
    }
  ]
}`;
}

/**
 * Memanggil Claude API untuk mencari temuan literatur terbaru terkait
 * topic_tag, dengan konteks program (fase periodisasi & cabang olahraga).
 * Pakai web search tool bawaan Anthropic supaya hasilnya benar-benar
 * dari pencarian internet real-time, bukan dari memori model.
 * Structured Outputs (output_config.format) dipakai sebagai jaminan
 * teknis tambahan supaya JSON yang kembali selalu valid -- di luar
 * instruksi format yang sudah ada di system prompt.
 */
export async function scanLiterature(
  topicTag: string,
  programContext: string
): Promise<LiteratureFinding[]> {
  const client = getAnthropicClient();

  const response = await client.messages.parse({
    model: "claude-opus-5",
    max_tokens: 4096,
    system: buildSystemPrompt(topicTag, programContext),
    tools: [{ type: "web_search_20260209", name: "web_search", max_uses: 8 }],
    output_config: {
      format: zodOutputFormat(literatureScanOutputSchema),
      effort: "medium",
    },
    messages: [
      {
        role: "user",
        content: `Cari temuan penelitian terbaru untuk topic_tag: "${topicTag}".`,
      },
    ],
  });

  if (response.stop_reason === "refusal") {
    throw new Error("Permintaan ditolak oleh sistem keamanan Claude.");
  }

  if (!response.parsed_output) {
    throw new Error("Gagal mem-parsing hasil pencarian literatur dari Claude.");
  }

  return response.parsed_output.findings;
}
