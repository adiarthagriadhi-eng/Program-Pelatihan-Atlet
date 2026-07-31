import type { PoolClient } from "pg";

export type ProposedChanges = {
  phase_id: number;
  volume_delta_percent: number | null;
  intensity_delta_percent: number | null;
  session_type_swap: { from: string; to: string } | null;
  rationale: string;
};

/**
 * Menerapkan proposed_changes ke training_sessions terkait -- hanya sesi
 * terjadwal mulai hari ini (sesi yang sudah lewat tidak diubah retroaktif).
 * Dipanggil HANYA dari alur Approve/Edit, tidak pernah otomatis.
 */
export async function applyChangesToSessions(
  client: PoolClient,
  changes: ProposedChanges
): Promise<void> {
  if (changes.volume_delta_percent != null) {
    await client.query(
      `UPDATE training_sessions
       SET planned_volume = ROUND(planned_volume * (1 + $1::numeric / 100), 2)
       WHERE phase_id = $2 AND session_date >= CURRENT_DATE AND planned_volume IS NOT NULL`,
      [changes.volume_delta_percent, changes.phase_id]
    );
  }

  if (changes.intensity_delta_percent != null) {
    await client.query(
      `UPDATE training_sessions
       SET planned_intensity = ROUND(planned_intensity * (1 + $1::numeric / 100), 2)
       WHERE phase_id = $2 AND session_date >= CURRENT_DATE AND planned_intensity IS NOT NULL`,
      [changes.intensity_delta_percent, changes.phase_id]
    );
  }

  if (changes.session_type_swap) {
    await client.query(
      `UPDATE training_sessions
       SET session_type = $1
       WHERE phase_id = $2 AND session_type = $3 AND session_date >= CURRENT_DATE`,
      [changes.session_type_swap.to, changes.phase_id, changes.session_type_swap.from]
    );
  }
}
