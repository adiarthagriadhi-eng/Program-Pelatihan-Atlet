import { NextResponse } from "next/server";
import { getPool } from "@/lib/db";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const sourceId = Number(id);

  if (!Number.isInteger(sourceId) || sourceId <= 0) {
    return NextResponse.json(
      { status: "error", message: "ID sumber tidak valid." },
      { status: 400 }
    );
  }

  try {
    const { rows } = await getPool().query<{ id: number }>(
      `UPDATE knowledge_sources
       SET verified = true, verified_at = now()
       WHERE id = $1
       RETURNING id`,
      [sourceId]
    );

    if (rows.length === 0) {
      return NextResponse.json(
        { status: "error", message: "Sumber tidak ditemukan." },
        { status: 404 }
      );
    }

    return NextResponse.json({ status: "ok" });
  } catch (error) {
    console.error("Gagal memverifikasi sumber pengetahuan:", error);
    return NextResponse.json(
      { status: "error", message: "Gagal menyimpan verifikasi. Coba lagi." },
      { status: 500 }
    );
  }
}
