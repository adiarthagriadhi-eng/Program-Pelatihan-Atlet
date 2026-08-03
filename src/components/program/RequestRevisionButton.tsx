"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function RequestRevisionButton({ programId }: { programId: number }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ text: string; ready: boolean } | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleClick() {
    setLoading(true);
    setMessage(null);
    setError(null);

    try {
      const response = await fetch(`/api/programs/${programId}/request-revision`, {
        method: "POST",
      });

      let data: { message?: string; ready?: boolean; draftedCount?: number } | null = null;
      try {
        data = await response.json();
      } catch {
        data = null;
      }

      if (!response.ok) {
        if (response.status === 504) {
          setError("Penilaian melebihi batas waktu server. Coba lagi.");
        } else {
          setError(data?.message ?? "Gagal memproses permintaan revisi.");
        }
        return;
      }

      setMessage({ text: data?.message ?? "Selesai.", ready: data?.ready ?? true });
      router.refresh();
    } catch {
      setError("Tidak bisa terhubung ke server. Periksa koneksi internet Anda.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <button
        type="button"
        onClick={handleClick}
        disabled={loading}
        className="rounded-md border border-blue-300 px-4 py-2 text-sm font-medium text-blue-700 transition hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-blue-800 dark:text-blue-400 dark:hover:bg-blue-950"
      >
        {loading ? "Menilai kaidah pelatihan..." : "Minta Revisi"}
      </button>

      {error && (
        <p className="mt-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-300">
          {error}
        </p>
      )}

      {message && (
        <p
          className={`mt-2 rounded-md border px-3 py-2 text-sm ${
            message.ready
              ? "border-blue-200 bg-blue-50 text-blue-800 dark:border-blue-900 dark:bg-blue-950 dark:text-blue-300"
              : "border-zinc-200 bg-zinc-50 text-zinc-600 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400"
          }`}
        >
          {message.text}
        </p>
      )}
    </div>
  );
}
