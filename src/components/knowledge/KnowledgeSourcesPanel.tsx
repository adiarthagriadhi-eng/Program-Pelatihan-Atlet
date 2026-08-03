"use client";

import { useState, type FormEvent, type ReactNode } from "react";
import { useRouter } from "next/navigation";

export type KnowledgeSourceRow = {
  id: number;
  title: string;
  source_url: string | null;
  source_type: "manual_upload" | "assisted_search";
  uploaded_content: string | null;
  verified: boolean;
  verified_at: string | null;
  created_at: string;
};

const SOURCE_TYPE_LABELS: Record<KnowledgeSourceRow["source_type"], string> = {
  manual_upload: "Upload Manual",
  assisted_search: "Hasil Pencarian AI",
};

function inputClass(hasError: boolean) {
  return [
    "w-full rounded-md border px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 bg-white dark:bg-zinc-900 text-black dark:text-zinc-50",
    hasError
      ? "border-red-400 focus:ring-red-300"
      : "border-zinc-300 dark:border-zinc-700 focus:ring-blue-300",
  ].join(" ");
}

function Field({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: ReactNode;
}) {
  return (
    <div>
      <label className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
        {label}
      </label>
      {children}
      {error && <p className="mt-1 text-xs text-red-600 dark:text-red-400">{error}</p>}
    </div>
  );
}

export default function KnowledgeSourcesPanel({
  sportId,
  draftSources,
  verifiedSources,
}: {
  sportId: number;
  draftSources: KnowledgeSourceRow[];
  verifiedSources: KnowledgeSourceRow[];
}) {
  const [addingManual, setAddingManual] = useState(false);
  const [searching, setSearching] = useState(false);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          onClick={() => setAddingManual((v) => !v)}
          className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-700"
        >
          {addingManual ? "Batal" : "+ Tambah Sumber Manual"}
        </button>
        <button
          type="button"
          onClick={() => setSearching((v) => !v)}
          className="rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 transition hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-900"
        >
          {searching ? "Batal" : "Cari dengan AI"}
        </button>
      </div>

      {addingManual && (
        <ManualSourceForm sportId={sportId} onDone={() => setAddingManual(false)} />
      )}
      {searching && <SearchSourceForm sportId={sportId} onDone={() => setSearching(false)} />}

      <div>
        <h3 className="mb-2 text-sm font-medium text-zinc-700 dark:text-zinc-300">
          Belum Diverifikasi ({draftSources.length})
        </h3>
        {draftSources.length === 0 ? (
          <p className="text-sm text-zinc-500">Tidak ada draft sumber menunggu review.</p>
        ) : (
          <div className="space-y-3">
            {draftSources.map((source) => (
              <SourceCard key={source.id} source={source} />
            ))}
          </div>
        )}
      </div>

      <div>
        <h3 className="mb-2 text-sm font-medium text-zinc-700 dark:text-zinc-300">
          Terverifikasi ({verifiedSources.length})
        </h3>
        {verifiedSources.length === 0 ? (
          <p className="text-sm text-zinc-500">Belum ada sumber terverifikasi.</p>
        ) : (
          <div className="space-y-3">
            {verifiedSources.map((source) => (
              <SourceCard key={source.id} source={source} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function SourceCard({ source }: { source: KnowledgeSourceRow }) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState<"verify" | "delete" | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleVerify() {
    setError(null);
    setSubmitting("verify");
    try {
      const response = await fetch(`/api/knowledge-sources/${source.id}/verify`, {
        method: "POST",
      });
      const data = await response.json();
      if (!response.ok) {
        setError(data.message ?? "Gagal memverifikasi sumber.");
        return;
      }
      router.refresh();
    } catch {
      setError("Tidak bisa terhubung ke server.");
    } finally {
      setSubmitting(null);
    }
  }

  async function handleDelete() {
    setError(null);
    setSubmitting("delete");
    try {
      const response = await fetch(`/api/knowledge-sources/${source.id}`, {
        method: "DELETE",
      });
      const data = await response.json();
      if (!response.ok) {
        setError(data.message ?? "Gagal menghapus sumber.");
        return;
      }
      router.refresh();
    } catch {
      setError("Tidak bisa terhubung ke server.");
    } finally {
      setSubmitting(null);
    }
  }

  return (
    <div className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="font-medium text-zinc-900 dark:text-zinc-50">{source.title}</p>
          {source.source_url && (
            <a
              href={source.source_url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-blue-600 hover:underline dark:text-blue-400"
            >
              {source.source_url}
            </a>
          )}
        </div>
        <span className="shrink-0 rounded-full bg-zinc-100 px-2.5 py-0.5 text-xs font-medium text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
          {SOURCE_TYPE_LABELS[source.source_type]}
        </span>
      </div>

      {source.uploaded_content && (
        <p className="mt-2 whitespace-pre-wrap text-sm text-zinc-600 dark:text-zinc-300">
          {source.uploaded_content}
        </p>
      )}

      {error && <p className="mt-2 text-xs text-red-600 dark:text-red-400">{error}</p>}

      <div className="mt-3 flex gap-3">
        {!source.verified && (
          <button
            type="button"
            onClick={handleVerify}
            disabled={submitting !== null}
            className="rounded-md bg-green-600 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {submitting === "verify" ? "Memverifikasi..." : "Verifikasi"}
          </button>
        )}
        <button
          type="button"
          onClick={handleDelete}
          disabled={submitting !== null}
          className="rounded-md border border-red-300 px-3 py-1.5 text-xs font-medium text-red-700 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-red-900 dark:text-red-400 dark:hover:bg-red-950"
        >
          {submitting === "delete" ? "Menghapus..." : "Hapus"}
        </button>
      </div>
    </div>
  );
}

type ManualFormState = { title: string; sourceUrl: string; uploadedContent: string };
type ManualFormErrors = Partial<Record<keyof ManualFormState | "_form", string[]>>;

function ManualSourceForm({ sportId, onDone }: { sportId: number; onDone: () => void }) {
  const router = useRouter();
  const [form, setForm] = useState<ManualFormState>({
    title: "",
    sourceUrl: "",
    uploadedContent: "",
  });
  const [errors, setErrors] = useState<ManualFormErrors>({});
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setErrors({});
    setSubmitting(true);

    try {
      const response = await fetch("/api/knowledge-sources", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sportId: String(sportId),
          title: form.title,
          sourceUrl: form.sourceUrl || undefined,
          uploadedContent: form.uploadedContent || undefined,
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        setErrors(data.errors ?? { _form: [data.message ?? "Gagal menyimpan sumber."] });
        return;
      }
      router.refresh();
      onDone();
    } catch {
      setErrors({ _form: ["Tidak bisa terhubung ke server."] });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-4 rounded-lg border border-blue-200 p-4 dark:border-blue-900"
      noValidate
    >
      {errors._form && (
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-300">
          {errors._form[0]}
        </div>
      )}

      <Field label="Judul" error={errors.title?.[0]}>
        <input
          type="text"
          value={form.title}
          onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
          className={inputClass(!!errors.title)}
          placeholder="Contoh: Panduan periodisasi renang jarak menengah"
        />
      </Field>

      <Field label="URL Sumber (opsional)" error={errors.sourceUrl?.[0]}>
        <input
          type="text"
          value={form.sourceUrl}
          onChange={(e) => setForm((f) => ({ ...f, sourceUrl: e.target.value }))}
          className={inputClass(!!errors.sourceUrl)}
          placeholder="https://..."
        />
      </Field>

      <Field label="Konten / Catatan" error={errors.uploadedContent?.[0]}>
        <textarea
          value={form.uploadedContent}
          onChange={(e) => setForm((f) => ({ ...f, uploadedContent: e.target.value }))}
          className={inputClass(!!errors.uploadedContent)}
          rows={5}
          placeholder="Tempel ringkasan/isi dokumen, atau catatan Anda sebagai pakar."
        />
      </Field>

      <button
        type="submit"
        disabled={submitting}
        className="w-full rounded-md bg-blue-600 py-2 text-sm font-medium text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {submitting ? "Menyimpan..." : "Simpan Sumber"}
      </button>
    </form>
  );
}

function SearchSourceForm({ sportId, onDone }: { sportId: number; onDone: () => void }) {
  const router = useRouter();
  const [topicTag, setTopicTag] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [resultMessage, setResultMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setResultMessage(null);

    if (!topicTag.trim()) {
      setError("Topik pencarian wajib diisi.");
      return;
    }

    setLoading(true);
    try {
      const response = await fetch("/api/knowledge-sources/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sportId: String(sportId), topicTag: topicTag.trim() }),
      });

      let data: { message?: string; count?: number } | null = null;
      try {
        data = await response.json();
      } catch {
        data = null;
      }

      if (!response.ok) {
        if (response.status === 504) {
          setError("Pencarian melebihi batas waktu server. Coba topik yang lebih spesifik.");
        } else {
          setError(data?.message ?? "Gagal menjalankan pencarian.");
        }
        return;
      }

      setResultMessage(
        data?.count
          ? `${data.count} draft sumber ditambahkan -- tinjau & verifikasi di daftar "Belum Diverifikasi" di bawah.`
          : "Tidak ada sumber relevan yang ditemukan untuk topik ini."
      );
      router.refresh();
    } catch {
      setError("Tidak bisa terhubung ke server.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-4 rounded-lg border border-blue-200 p-4 dark:border-blue-900"
      noValidate
    >
      <p className="text-xs text-zinc-500">
        Hasil pencarian TIDAK langsung masuk basis pengetahuan -- tersimpan sebagai draft yang
        wajib Anda tinjau & verifikasi manual dulu.
      </p>

      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-300">
          {error}
        </div>
      )}
      {resultMessage && (
        <div className="rounded-md border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800 dark:border-green-900 dark:bg-green-950 dark:text-green-300">
          {resultMessage}
        </div>
      )}

      <Field label="Topik Pencarian">
        <input
          type="text"
          value={topicTag}
          onChange={(e) => setTopicTag(e.target.value)}
          className={inputClass(false)}
          placeholder="Contoh: taper strategy untuk lari jarak menengah"
        />
      </Field>

      <div className="flex gap-3">
        <button
          type="submit"
          disabled={loading}
          className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading ? "Mencari... (bisa sampai 1 menit)" : "Cari"}
        </button>
        <button
          type="button"
          onClick={onDone}
          className="rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 transition hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-900"
        >
          Tutup
        </button>
      </div>
    </form>
  );
}
