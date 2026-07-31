import Anthropic from "@anthropic-ai/sdk";

declare global {
  var anthropicClient: Anthropic | undefined;
}

// Client dibuat baru pertama kali benar-benar dipakai (bukan saat file
// diimpor), supaya proses build tidak butuh ANTHROPIC_API_KEY.
export function getAnthropicClient(): Anthropic {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error(
      "ANTHROPIC_API_KEY belum diatur. Isi di file .env.local (lihat .env.example)."
    );
  }
  if (!global.anthropicClient) {
    global.anthropicClient = new Anthropic();
  }
  return global.anthropicClient;
}
