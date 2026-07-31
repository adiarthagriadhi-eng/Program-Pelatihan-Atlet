import { NextResponse } from "next/server";
import { getPool } from "@/lib/db";
import { applyChangesToSessions, type ProposedChanges } from "@/lib/apply-revision";

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

  const client = await getPool().connect();

  try {
    await client.query("BEGIN");

    const { rows } = await client.query<{
      status: string;
      proposed_changes: ProposedChanges;
    }>(
      `SELECT status, proposed_changes FROM revision_log WHERE id = $1 FOR UPDATE`,
      [revisionId]
    );

    if (rows.length === 0) {
      await client.query("ROLLBACK");
      return NextResponse.json(
        { status: "error", message: "Revisi tidak ditemukan." },
        { status: 404 }
      );
    }

    if (rows[0].status !== "pending_review") {
      await client.query("ROLLBACK");
      return NextResponse.json(
        { status: "error", message: "Revisi ini sudah direview sebelumnya." },
        { status: 409 }
      );
    }

    await applyChangesToSessions(client, rows[0].proposed_changes);

    await client.query(
      `UPDATE revision_log SET status = 'approved', reviewed_at = now() WHERE id = $1`,
      [revisionId]
    );

    await client.query("COMMIT");

    return NextResponse.json({ status: "ok" });
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Gagal menyetujui revisi:", error);
    return NextResponse.json(
      { status: "error", message: "Gagal menerapkan revisi. Coba lagi." },
      { status: 500 }
    );
  } finally {
    client.release();
  }
}
