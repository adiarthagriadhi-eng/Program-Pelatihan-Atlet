"use client";

import { useState, type FormEvent } from "react";

type Athlete = { id: number; name: string };

type Finding = {
  source_title: string;
  source_url: string;
  summary: string;
  relevance_score: number;
  caution_note: string | null;
};

export default function LiteratureScanForm({ athletes }: { athletes: Athlete[] }) {
  const [topicTag, setTopicTag] = useState("");
  const [athleteId, setAthleteId] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [findings, setFindings] = useState<Finding[] | null>(null);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setFindings(null);

    const trimmedTopic = topicTag.trim();
    if (!trimmedTopic) {
      setError("Topic tag wajib diisi.");
      return;
    }

    setLoading(true);

    try {
      const response = await fetch("/api/literature-scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          topicTag: trimmedTopic,
          ...(athleteId ? { athleteId: Number(athleteId) } : {}),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.message ?? "Gagal menjalankan pemindaian literatur.");
        return;
      }

      setFindings(data.findings ?? []);
    } catch {
      setError("Tidak bisa terhubung ke server. Periksa koneksi internet Anda.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-8">
      <form onSubmit={handleSubmit} className="space-y-5" noValidate>
        <div>
          <label className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
            Topic Tag
          </label>
          <input
            type="text"
            value={topicTag}
            onChange={(e) => setTopicTag(e.target.value)}
            placeholder="Contoh: recovery sprint training"
            className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-black shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-300 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
            Konteks Atlet (opsional)
          </label>
          <select
            value={athleteId}
            onChange={(e) => setAthleteId(e.target.value)}
            className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-black shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-300 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
          >
            <option value="">-- Tanpa konteks spesifik --</option>
            {athletes.map((athlete) => (
              <option key={athlete.id} value={athlete.id}>
                {athlete.name}
              </option>
            ))}
          </select>
          <p className="mt-1 text-xs text-zinc-500">
            Kalau dipilih, cabang olahraga &amp; fase periodisasi atlet ini dipakai sebagai
            konteks program untuk menilai relevansi temuan.
          </p>
        </div>

        {error && (
          <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-300">
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-md bg-blue-600 py-2.5 font-medium text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading ? "Mencari... (bisa sampai 1 menit)" : "Cari Temuan"}
        </button>
      </form>

      {findings && (
        <div className="space-y-4">
          <h2 className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
            {findings.length === 0
              ? "Tidak ada temuan yang relevan."
              : `${findings.length} temuan tersimpan ke database:`}
          </h2>
          {findings.map((finding, index) => (
            <div
              key={index}
              className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-800"
            >
              <a
                href={finding.source_url}
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium text-blue-600 hover:underline dark:text-blue-400"
              >
                {finding.source_title}
              </a>
              <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-300">{finding.summary}</p>
              <p className="mt-2 text-xs text-zinc-500">
                Relevance score: {finding.relevance_score.toFixed(2)}
              </p>
              {finding.caution_note && (
                <p className="mt-2 rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:bg-amber-950 dark:text-amber-300">
                  ⚠ {finding.caution_note}
                </p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
