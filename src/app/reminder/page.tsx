import Link from "next/link";
import { getPool } from "@/lib/db";
import { MILESTONE_TYPE_LABELS, type MilestoneType } from "@/lib/constants/milestone";

export const dynamic = "force-dynamic";

type ReminderRow = {
  id: number;
  channel: string;
  status: "scheduled" | "sent" | "failed";
  scheduled_for: string;
  sent_at: string | null;
  athlete_name: string;
  target_date: string;
  milestone_type: MilestoneType;
  description: string | null;
};

const CHANNEL_LABELS: Record<string, string> = {
  push: "Notifikasi Aplikasi",
  email: "Email",
  whatsapp: "WhatsApp",
  sms: "SMS",
};

const STATUS_LABELS: Record<string, string> = {
  scheduled: "Terjadwal",
  sent: "Terkirim",
  failed: "Gagal",
};

const STATUS_CLASSES: Record<string, string> = {
  scheduled: "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300",
  sent: "bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300",
  failed: "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300",
};

function formatDateTime(value: string | null): string {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" });
}

export default async function RiwayatReminderPage() {
  let reminders: ReminderRow[] = [];
  let loadError: string | null = null;

  try {
    const result = await getPool().query<ReminderRow>(`
      SELECT
        rl.id,
        rl.channel,
        rl.status,
        rl.scheduled_for,
        rl.sent_at,
        a.name AS athlete_name,
        m.target_date,
        m.milestone_type,
        m.description
      FROM reminders_log rl
      JOIN milestones m ON rl.milestone_id = m.id
      JOIN athletes a ON m.athlete_id = a.id
      ORDER BY rl.scheduled_for DESC
    `);
    reminders = result.rows;
  } catch (error) {
    console.error("Gagal memuat riwayat reminder:", error);
    loadError = "Gagal terhubung ke database. Periksa koneksi lalu muat ulang halaman.";
  }

  return (
    <main className="mx-auto w-full max-w-4xl px-4 py-10 sm:py-16">
      <Link
        href="/"
        className="mb-6 inline-block text-sm text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200"
      >
        &larr; Kembali
      </Link>

      <h1 className="mb-1 text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
        Riwayat Reminder
      </h1>
      <p className="mb-8 text-sm text-zinc-500">
        Catatan semua reminder milestone yang sudah diproses oleh sistem, untuk audit apakah
        pengingat benar-benar terkirim.
      </p>

      {loadError && (
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-300">
          {loadError}
        </div>
      )}

      {!loadError && reminders.length === 0 && (
        <div className="rounded-md border border-zinc-200 bg-zinc-50 px-4 py-6 text-center text-sm text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900">
          Belum ada reminder yang tercatat. Reminder dicek otomatis sekali sehari untuk milestone
          yang jatuh tempo dalam 30, 7, atau 1 hari ke depan.
        </div>
      )}

      {!loadError && reminders.length > 0 && (
        <div className="overflow-x-auto rounded-lg border border-zinc-200 dark:border-zinc-800">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="bg-zinc-50 text-xs uppercase text-zinc-500 dark:bg-zinc-900 dark:text-zinc-400">
              <tr>
                <th className="px-4 py-3 font-medium">Dikirim Pada</th>
                <th className="px-4 py-3 font-medium">Atlet</th>
                <th className="px-4 py-3 font-medium">Milestone</th>
                <th className="px-4 py-3 font-medium">Tanggal Target</th>
                <th className="px-4 py-3 font-medium">Channel</th>
                <th className="px-4 py-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
              {reminders.map((reminder) => (
                <tr key={reminder.id}>
                  <td className="px-4 py-3 text-zinc-600 dark:text-zinc-300">
                    {formatDateTime(reminder.sent_at ?? reminder.scheduled_for)}
                  </td>
                  <td className="px-4 py-3 font-medium text-zinc-900 dark:text-zinc-50">
                    {reminder.athlete_name}
                  </td>
                  <td className="px-4 py-3 text-zinc-600 dark:text-zinc-300">
                    {MILESTONE_TYPE_LABELS[reminder.milestone_type]}
                    {reminder.description ? ` — ${reminder.description}` : ""}
                  </td>
                  <td className="px-4 py-3 text-zinc-600 dark:text-zinc-300">
                    {formatDate(reminder.target_date)}
                  </td>
                  <td className="px-4 py-3 text-zinc-600 dark:text-zinc-300">
                    {CHANNEL_LABELS[reminder.channel] ?? reminder.channel}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_CLASSES[reminder.status]}`}
                    >
                      {STATUS_LABELS[reminder.status] ?? reminder.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
