import { NextResponse } from "next/server";
import { getPool } from "@/lib/db";

// GET /api/health/db - cek koneksi database & daftar tabel yang ada.
export async function GET() {
  try {
    const { rows: tables } = await getPool().query<{ table_name: string }>(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      ORDER BY table_name
    `);

    return NextResponse.json({
      status: "ok",
      tables: tables.map((t) => t.table_name),
    });
  } catch (error) {
    return NextResponse.json(
      {
        status: "error",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
