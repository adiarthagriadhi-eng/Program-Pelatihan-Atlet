import { NextResponse } from "next/server";
import { getPool } from "@/lib/db";
import { scanLiterature } from "@/lib/literature-scanner";
import { knowledgeSourceSearchSchema } from "@/lib/validation/knowledge-source";

// Web search + reasoning bisa makan waktu puluhan detik; perpanjang batas
// waktu function di Vercel (default 10 detik terlalu singkat untuk ini).
export const maxDuration = 60;

/**
 * "Cari dengan AI" untuk Basis Pengetahuan Statis. Memakai scanLiterature()
 * yang sama (sudah diperkeras terhadap halusinasi -- lihat
 * lib/literature-scanner.ts), TAPI hasilnya TIDAK PERNAH langsung dipakai
 * sistem: setiap temuan disimpan sebagai knowledge_sources draft dengan
 * verified=false (source_type='assisted_search'). Baru bisa dipakai
 * training_guidelines setelah pelatih menekan "Verifikasi" secara manual
 * di halaman Basis Pengetahuan.
 */
export async function POST(request: Request) {
  const body = await request.json().catch(() => null);

  if (!body) {
    return NextResponse.json(
      { status: "error", message: "Data yang dikirim tidak valid." },
      { status: 400 }
    );
  }

  const parsed = knowledgeSourceSearchSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { status: "error", errors: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  const { sportId, topicTag } = parsed.data;

  try {
    const { rows: sportRows } = await getPool().query<{
      name: string;
      category: string;
      primary_energy_system: string | null;
    }>(`SELECT name, category, primary_energy_system FROM sports WHERE id = $1`, [sportId]);

    const sport = sportRows[0];
    if (!sport) {
      return NextResponse.json(
        { status: "error", message: "Cabang olahraga tidak ditemukan." },
        { status: 404 }
      );
    }

    const programContext = `Cabang olahraga: ${sport.name} (kategori ${sport.category}${
      sport.primary_energy_system ? `, sistem energi utama ${sport.primary_energy_system}` : ""
    }).`;

    const findings = await scanLiterature(topicTag, programContext);

    let insertedCount = 0;

    for (const finding of findings) {
      await getPool().query(
        `INSERT INTO knowledge_sources
           (sport_id, title, source_url, source_type, uploaded_content, verified)
         VALUES ($1, $2, $3, 'assisted_search', $4, false)`,
        [sportId, finding.source_title, finding.source_url, finding.summary]
      );
      insertedCount += 1;
    }

    return NextResponse.json({ status: "ok", count: insertedCount }, { status: 201 });
  } catch (error) {
    console.error("Gagal menjalankan pencarian sumber pengetahuan:", error);
    const message =
      error instanceof Error && error.message
        ? error.message
        : "Gagal menjalankan pencarian. Coba lagi.";
    return NextResponse.json({ status: "error", message }, { status: 500 });
  }
}
