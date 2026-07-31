import { NextResponse } from "next/server";
import { getPool } from "@/lib/db";
import { applyChangesToSessions, type ProposedChanges } from "@/lib/apply-revision";
import { revisionEditSchema } from "@/lib/validation/revision";

export async function POST(
  request: Request,
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

  const body = await request.json().catch(() => null);

  if (!body) {
    return NextResponse.json(
      { status: "error", message: "Data yang dikirim tidak valid." },
      { status: 400 }
    );
  }

  const parsed = revisionEditSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { status: "error", errors: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  const { volumeDeltaPercent, intensityDeltaPercent, sessionTypeFrom, sessionTypeTo, rationale } =
    parsed.data;

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

    const editedChanges: ProposedChanges = {
      phase_id: rows[0].proposed_changes.phase_id,
      volume_delta_percent: volumeDeltaPercent,
      intensity_delta_percent: intensityDeltaPercent,
      session_type_swap:
        sessionTypeFrom && sessionTypeTo ? { from: sessionTypeFrom, to: sessionTypeTo } : null,
      rationale,
    };

    await applyChangesToSessions(client, editedChanges);

    await client.query(
      `UPDATE revision_log
       SET status = 'edited_and_approved', proposed_changes = $1, reviewed_at = now()
       WHERE id = $2`,
      [JSON.stringify(editedChanges), revisionId]
    );

    await client.query("COMMIT");

    return NextResponse.json({ status: "ok" });
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Gagal menerapkan revisi yang diedit:", error);
    return NextResponse.json(
      { status: "error", message: "Gagal menerapkan revisi. Coba lagi." },
      { status: 500 }
    );
  } finally {
    client.release();
  }
}
