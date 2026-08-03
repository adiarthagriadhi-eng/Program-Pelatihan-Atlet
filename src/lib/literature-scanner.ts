import { z } from "zod";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import type { ContentBlock } from "@anthropic-ai/sdk/resources/messages";
import { getAnthropicClient } from "@/lib/anthropic";

const literatureFindingSchema = z.object({
  source_title: z.string(),
  source_url: z.string(),
  summary: z.string(),
  relevance_score: z.number().min(0).max(1),
});

const literatureScanOutputSchema = z.object({
  findings: z.array(literatureFindingSchema),
});

export type LiteratureFinding = z.infer<typeof literatureFindingSchema>;

// System prompt disertakan PERSIS seperti yang diberikan, ditambah blok
// "ATURAN ANTI-HALUSINASI" di akhir -- placeholder {topic_tag} dan
// ringkasan konteks program tetap diisi seperti sebelumnya.
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
   DI DALAM summary sebagai catatan kehati-hatian (mis. "Catatan: n=18,
   desain observasional"), JANGAN sembunyikan.
5. Jika tidak ada temuan yang benar-benar relevan, kembalikan array
   kosong -- JANGAN memaksakan temuan yang tidak related.

ATURAN ANTI-HALUSINASI (WAJIB DIPATUHI):
6. Anda WAJIB memanggil tool web_search sebelum menulis satupun temuan.
   JANGAN PERNAH menjawab dari ingatan/pengetahuan umum Anda.
7. Setiap source_url yang Anda kembalikan HARUS disalin persis dari
   field "url" pada hasil web_search yang benar-benar muncul di respons
   tool -- JANGAN mengarang, menebak, atau merekonstruksi URL dari
   ingatan Anda meskipun Anda yakin sumber itu ada.
8. Kalau web_search tidak tersedia, gagal, timeout, atau tidak
   mengembalikan hasil yang relevan, JANGAN mengarang temuan sebagai
   gantinya -- kembalikan array findings KOSONG, TANPA source_url palsu.
9. JANGAN pernah menulis catatan seperti "verifikasi manual diperlukan"
   atau "akses pencarian terbatas" sebagai pengganti pencarian nyata --
   itu tandanya Anda mengarang. Kalau pencarian tidak berhasil, kembalikan
   array kosong (lihat aturan 8), jangan tetap membuat entri.

Kembalikan HANYA dalam format JSON berikut, tanpa teks tambahan apapun:

{
  "findings": [
    {
      "source_title": "...",
      "source_url": "...",
      "summary": "... (2-3 kalimat, parafrase, sertakan catatan kehati-hatian di sini kalau ada)",
      "relevance_score": 0.00
    }
  ]
}`;
}

// Dibandingkan lewat host + path saja (BUKAN full URL termasuk query
// string/protocol). URL asli dari web_search sering membawa parameter
// pelacakan (?utm_..., ?otool=, redirect wrapper, dst) yang beda dari
// versi "bersih" yang ditulis ulang model -- membandingkan full URL
// persis-sama membuat hasil pencarian yang SAH ikut terbuang. Path tetap
// jadi jangkar anti-halusinasi: URL karangan biasanya punya path/ID yang
// sama sekali berbeda (mis. ID PubMed acak), bukan cuma beda query
// string, jadi tetap tertangkap dengan perbandingan ini.
export function normalizeUrl(url: string): string {
  try {
    const parsed = new URL(url.trim());
    const host = parsed.hostname.toLowerCase().replace(/^www\./, "");
    const path = parsed.pathname.toLowerCase().replace(/\/+$/, "");
    return `${host}${path}`;
  } catch {
    return url.trim().toLowerCase();
  }
}

export type SearchGrounding = {
  webSearchInvoked: boolean;
  successfulSearchCount: number;
  searchErrorCodes: string[];
  verifiedUrls: Set<string>;
};

/**
 * Sumber kebenaran untuk anti-halusinasi: dianalisis dari CONTENT BLOCK
 * mentah respons API (server_tool_use & web_search_tool_result), bukan
 * dari teks/JSON yang ditulis model -- supaya model tidak bisa
 * "mengaku" sudah mencari padahal tidak, atau mengarang URL yang
 * kelihatan meyakinkan.
 */
export function analyzeSearchGrounding(content: ContentBlock[]): SearchGrounding {
  let webSearchInvoked = false;
  let successfulSearchCount = 0;
  const searchErrorCodes: string[] = [];
  const verifiedUrls = new Set<string>();

  for (const block of content) {
    if (block.type === "server_tool_use" && block.name === "web_search") {
      webSearchInvoked = true;
    }
    if (block.type === "web_search_tool_result") {
      if (Array.isArray(block.content)) {
        successfulSearchCount += 1;
        for (const result of block.content) {
          verifiedUrls.add(normalizeUrl(result.url));
        }
      } else {
        searchErrorCodes.push(block.content.error_code);
      }
    }
  }

  return { webSearchInvoked, successfulSearchCount, searchErrorCodes, verifiedUrls };
}

/**
 * Membuang temuan yang source_url-nya tidak cocok dengan URL nyata mana
 * pun dari hasil web_search -- pertahanan terakhir kalau model tetap
 * mengarang URL meskipun sudah melakukan pencarian sungguhan untuk
 * temuan lain.
 */
export function filterVerifiedFindings(
  findings: LiteratureFinding[],
  verifiedUrls: Set<string>
): LiteratureFinding[] {
  return findings.filter((finding) => {
    const normalized = normalizeUrl(finding.source_url);
    const isVerified = verifiedUrls.has(normalized);
    if (!isVerified) {
      console.warn(
        `[literature-scan] Membuang temuan dengan URL tak terverifikasi: "${finding.source_title}" -> ` +
          `${finding.source_url} (dibandingkan sebagai "${normalized}", verifiedUrls: ` +
          `${JSON.stringify(Array.from(verifiedUrls))})`
      );
    }
    return isVerified;
  });
}

/**
 * Memanggil Claude API untuk mencari temuan literatur terbaru terkait
 * topic_tag, dengan konteks program (fase periodisasi & cabang olahraga).
 * Pakai web search tool bawaan Anthropic supaya hasilnya benar-benar
 * dari pencarian internet real-time, bukan dari memori model.
 *
 * PENTING -- pertahanan anti-halusinasi tidak boleh hanya mengandalkan
 * instruksi prompt (model bisa saja tetap tidak patuh, terutama kalau
 * web_search gagal/timeout). Setelah respons diterima, fungsi ini
 * memanggil analyzeSearchGrounding() untuk memverifikasi secara
 * independen dari content block respons API:
 *   1. web_search benar-benar dipanggil (bukan dijawab dari ingatan).
 *   2. Setidaknya ada satu hasil pencarian yang berhasil (bukan semuanya
 *      error/kosong).
 *   3. Tiap source_url yang dikembalikan benar-benar cocok dengan salah
 *      satu URL yang muncul di web_search_tool_result -- temuan yang
 *      URL-nya tidak bisa diverifikasi DIBUANG lewat filterVerifiedFindings.
 * Kalau langkah 1 atau 2 gagal, fungsi ini melempar error (bukan
 * mengembalikan array kosong dari parsed_output milik model) supaya
 * kegagalan pencarian tidak pernah disalahartikan sebagai "tidak ada
 * temuan relevan".
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
    // Cakupan pencarian dibatasi supaya prosesnya konsisten di bawah 60
    // detik (batas keras Vercel Hobby plan). Effort "medium" (bukan
    // "low") -- pada effort rendah model cenderung melewati web_search
    // dan menjawab dari ingatan, yang persis masalah yang mau dicegah
    // di sini; analyzeSearchGrounding() di bawah tetap jadi jaring
    // pengaman independen kalau ini masih terjadi.
    tools: [{ type: "web_search_20260209", name: "web_search", max_uses: 4 }],
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

  if (response.stop_reason === "pause_turn") {
    throw new Error(
      "Pencarian web belum selesai dalam batas waktu internal API. Coba lagi dengan topik yang lebih spesifik."
    );
  }

  const grounding = analyzeSearchGrounding(response.content);

  console.log(
    `[literature-scan] topic="${topicTag}" webSearchInvoked=${grounding.webSearchInvoked} ` +
      `successfulSearchCalls=${grounding.successfulSearchCount} errorCodes=${JSON.stringify(
        grounding.searchErrorCodes
      )} verifiedUrlCount=${grounding.verifiedUrls.size}`
  );

  if (!grounding.webSearchInvoked) {
    throw new Error(
      "Model tidak memanggil web_search sama sekali -- hasil tidak bisa dipercaya sebagai temuan nyata. Coba lagi."
    );
  }

  if (grounding.successfulSearchCount === 0) {
    throw new Error(
      `Semua pemanggilan web_search gagal (${
        grounding.searchErrorCodes.join(", ") || "tidak diketahui"
      }). Coba lagi nanti.`
    );
  }

  if (!response.parsed_output) {
    throw new Error("Gagal mem-parsing hasil pencarian literatur dari Claude.");
  }

  return filterVerifiedFindings(response.parsed_output.findings, grounding.verifiedUrls);
}
