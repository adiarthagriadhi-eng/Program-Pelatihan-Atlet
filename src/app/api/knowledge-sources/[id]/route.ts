import { NextResponse } from "next/server";
import { getPool } from "@/lib/db";

export async function DELETE(
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
      `DELETE FROM knowledge_sources WHERE id = $1 RETURNING id`,
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
    // FK RESTRICT dari training_guidelines.source_id -- error code 23503
    // kalau sumber ini masih dipakai oleh kaidah pelatihan.
    const isForeignKeyViolation =
      typeof error === "object" && error !== null && "code" in error && error.code === "23503";

    console.error("Gagal menghapus sumber pengetahuan:", error);
    return NextResponse.json(
      {
        status: "error",
        message: isForeignKeyViolation
          ? "Sumber ini masih dipakai oleh satu atau lebih kaidah pelatihan -- hapus kaidahnya dulu."
          : "Gagal menghapus data. Coba lagi.",
      },
      { status: isForeignKeyViolation ? 409 : 500 }
    );
  }
}
