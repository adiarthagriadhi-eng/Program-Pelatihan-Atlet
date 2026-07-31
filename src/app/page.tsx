import Link from "next/link";

export default function Home() {
  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-10 sm:py-16">
      <h1 className="mb-1 text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
        Program Pelatihan Atlet
      </h1>
      <p className="mb-8 text-sm text-zinc-500">
        Susun & revisi program pelatihan atlet lintas cabang olahraga.
      </p>

      <div className="grid gap-4 sm:grid-cols-2">
        <MenuCard
          href="/dashboard"
          title="Dashboard Coach"
          description="Status ACWR/readiness semua atlet & revisi pending, sekilas pandang."
        />
        <MenuCard
          href="/atlet/baru"
          title="Tambah Atlet Baru"
          description="Daftarkan atlet baru ke sistem."
        />
        <MenuCard
          href="/assessment/harian"
          title="Input Assessment Harian"
          description="Isi cepat RPE, durasi sesi, jam tidur, dan wellness score."
        />
        <MenuCard
          href="/atlet"
          title="Daftar Atlet"
          description="Lihat semua atlet dan status ringkasnya."
        />
        <MenuCard
          href="/milestone/baru"
          title="Tambah Milestone"
          description="Catat target kompetisi, tes, transisi fase, atau PR."
        />
        <MenuCard
          href="/milestone"
          title="Daftar Milestone"
          description="Semua milestone atlet, urut tanggal terdekat."
        />
        <MenuCard
          href="/reminder"
          title="Riwayat Reminder"
          description="Audit reminder milestone yang sudah terkirim."
        />
        <MenuCard
          href="/literature-scan"
          title="Literature Scanner"
          description="Cari temuan penelitian sport science terbaru & kredibel."
        />
        <MenuCard
          href="/revisi"
          title="Review Revisi"
          description="Tinjau & setujui usulan perubahan program dari temuan literatur."
        />
      </div>
    </main>
  );
}

function MenuCard({
  href,
  title,
  description,
}: {
  href: string;
  title: string;
  description: string;
}) {
  return (
    <Link
      href={href}
      className="rounded-lg border border-zinc-200 p-5 shadow-sm transition hover:border-blue-300 hover:shadow-md dark:border-zinc-800 dark:hover:border-blue-800"
    >
      <h2 className="font-medium text-zinc-900 dark:text-zinc-50">{title}</h2>
      <p className="mt-1 text-sm text-zinc-500">{description}</p>
    </Link>
  );
}
