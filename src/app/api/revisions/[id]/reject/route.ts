import { NextResponse } from "next/server";
import { getPool } from "@/lib/db";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const revisionId = Number(id);

  if (!Number.isInteger(revisionId) || revisionId <= 0) {
    return NextResponse.json(
      { status: "error", message: "ID revisi tidak valid." },
      { status: 400 }
    );
  }

  try {
    const { rows } = await getPool().query<{ id: number }>(
      `UPDATE revision_log
       SET status = 'rejected', reviewed_at = now()
       WHERE id = $1 AND status = 'pending_review'
       RETURNING id`,
      [revisionId]
    );

    if (rows.length === 0) {
      return NextResponse.json(
        {
          status: "error",
          message: "Revisi tidak ditemukan atau sudah direview sebelumnya.",
        },
        { status: 409 }
      );
    }

    return NextResponse.json({ status: "ok" });
  } catch (error) {
    console.error("Gagal menolak revisi:", error);
    return NextResponse.json(
      { status: "error", message: "Gagal menyimpan penolakan. Coba lagi." },
      { status: 500 }
    );
  }
}
