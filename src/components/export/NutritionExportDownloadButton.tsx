"use client";

import { useState } from "react";

export default function NutritionExportDownloadButton({
  athleteId,
  label,
  compact = false,
}: {
  athleteId?: number;
  label: string;
  compact?: boolean;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleClick() {
    setLoading(true);
    setError(null);

    try {
      const url = athleteId ? `/api/export/nutrition?athleteId=${athleteId}` : "/api/export/nutrition";
      const response = await fetch(url);
      const data = await response.json();

      if (!response.ok || data.status !== "ok") {
        setError(data?.message ?? "Gagal membuat file ekspor.");
        return;
      }

      const blob = new Blob([JSON.stringify(data.payload, null, 2)], {
        type: "application/json",
      });
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      const dateStamp = new Date().toISOString().slice(0, 10);
      a.href = blobUrl;
      a.download = athleteId
        ? `ekspor-nutrisi-atlet-${athleteId}-${dateStamp}.json`
        : `ekspor-nutrisi-${dateStamp}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(blobUrl);
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
        className={
          compact
            ? "rounded-md border border-blue-300 px-2.5 py-1 text-xs font-medium text-blue-700 transition hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-blue-800 dark:text-blue-400 dark:hover:bg-blue-950"
            : "rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
        }
      >
        {loading ? "Menyiapkan..." : label}
      </button>
      {error && (
        <p className="mt-2 text-xs text-red-600 dark:text-red-400">{error}</p>
      )}
    </div>
  );
}
