import { NextResponse } from "next/server";
import { getPool } from "@/lib/db";

// Dipanggil otomatis sekali sehari oleh Vercel Cron Jobs (lihat vercel.json).
// Mencari milestone yang jatuh tempo dalam 30/7/1 hari (sesuai
// reminder_schedule_days per milestone), mencatat + "mengirim" reminder
// ke reminders_log. Channel yang dipakai: 'push' (notifikasi dalam
// aplikasi) -- untuk channel ini, mencatat baris = reminder sudah
// "terkirim" (langsung terlihat di halaman Riwayat Reminder).
export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ status: "error", message: "Unauthorized" }, { status: 401 });
  }

  try {
    const { rows: dueMilestones } = await getPool().query<{
      milestone_id: number;
      athlete_id: number;
      days_until: number;
    }>(`
      SELECT
        m.id AS milestone_id,
        m.athlete_id,
        (m.target_date - CURRENT_DATE) AS days_until
      FROM milestones m
      WHERE m.status = 'pending'
        AND (m.target_date - CURRENT_DATE) = ANY(m.reminder_schedule_days)
        AND NOT EXISTS (
          SELECT 1 FROM reminders_log rl
          WHERE rl.milestone_id = m.id
            AND rl.scheduled_for::date = CURRENT_DATE
        )
    `);

    for (const milestone of dueMilestones) {
      await getPool().query(
        `INSERT INTO reminders_log
           (milestone_id, recipient_type, recipient_id, channel, scheduled_for, sent_at, status)
         VALUES ($1, 'athlete', $2, 'push', now(), now(), 'sent')`,
        [milestone.milestone_id, milestone.athlete_id]
      );
    }

    return NextResponse.json({
      status: "ok",
      checked: dueMilestones.length,
      logged: dueMilestones.length,
    });
  } catch (error) {
    console.error("Gagal menjalankan cron milestone reminder:", error);
    return NextResponse.json(
      { status: "error", message: "Gagal menjalankan pengecekan reminder." },
      { status: 500 }
    );
  }
}
