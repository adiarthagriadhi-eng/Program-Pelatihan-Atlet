import { NextResponse } from "next/server";
import { getPool } from "@/lib/db";
import { knowledgeSourceFormSchema } from "@/lib/validation/knowledge-source";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);

  if (!body) {
    return NextResponse.json(
      { status: "error", message: "Data yang dikirim tidak valid." },
      { status: 400 }
    );
  }

  const parsed = knowledgeSourceFormSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { status: "error", errors: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  const { sportId, title, sourceUrl, uploadedContent } = parsed.data;

  try {
    const { rows } = await getPool().query<{ id: number }>(
      `INSERT INTO knowledge_sources (sport_id, title, source_url, source_type, uploaded_content, verified)
       VALUES ($1, $2, $3, 'manual_upload', $4, false)
       RETURNING id`,
      [sportId, title, sourceUrl, uploadedContent]
    );

    return NextResponse.json({ status: "ok", source: rows[0] }, { status: 201 });
  } catch (error) {
    console.error("Gagal menyimpan sumber pengetahuan:", error);
    return NextResponse.json(
      { status: "error", message: "Gagal menyimpan data ke database. Coba lagi." },
      { status: 500 }
    );
  }
}
