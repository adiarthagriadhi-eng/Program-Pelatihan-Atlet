# Deploy ke Hostinger (Cloud/Business Hosting — hPanel Node.js App)

Panduan ini untuk paket Hostinger yang hPanel-nya punya menu **Setup Node.js
App** (biasanya Cloud Hosting / Business Hosting ke atas). Aplikasi ini
butuh **PostgreSQL** (bukan MySQL) — paket hosting Hostinger jenis ini pada
umumnya tidak menyediakan PostgreSQL terkelola, jadi database tetap perlu
layanan eksternal (Supabase/Neon/Railway — sudah didukung lewat
`.env.example`). Rekomendasi: **Neon** (gratis untuk mulai, serverless,
tidak perlu kartu kredit).

## 1. Siapkan database PostgreSQL

1. Buat akun di [neon.tech](https://neon.tech) (atau Supabase/Railway kalau
   sudah biasa pakai itu), buat project baru.
2. Salin **connection string**-nya (format
   `postgresql://USER:PASSWORD@HOST/DATABASE?sslmode=require`).
3. Jalankan skema database **dari komputer lokal Anda** (paket hosting
   Hostinger jenis ini biasanya tidak punya `psql` di terminal-nya):
   ```bash
   psql "postgresql://USER:PASSWORD@HOST/DATABASE?sslmode=require" -f schema.sql
   ```
   Kalau providernya punya SQL editor di dashboard (Neon & Supabase
   punya), isi `schema.sql` juga bisa ditempel & dijalankan langsung di sana.

## 2. Upload kode ke Hostinger

Paling gampang lewat Git (hPanel biasanya punya menu **Git** di bawah
Advanced untuk clone dari GitHub), atau lewat File Manager/FTP kalau
repo-nya private dan belum terhubung ke Git di hPanel:

1. hPanel → **Advanced → Git** → hubungkan ke repo GitHub ini, pilih branch
   yang mau dipakai untuk production, lalu **Deploy**.
2. Pastikan file yang ter-upload termasuk `server.js`, `package.json`,
   `schema.sql`, dan seluruh folder `src/`.

## 3. Setup Node.js App

Di hPanel → **Advanced → Setup Node.js App** → **Create Application**:

| Field | Isi |
|---|---|
| Node.js version | Versi tertinggi yang tersedia, minimal **20.9** (project ini butuh Node ≥20.9 karena Next.js 16) |
| Application mode | Production |
| Application root | Folder tempat kode di-upload, mis. `program-pelatihan-atlet` |
| Application URL | Domain/subdomain tujuan, mis. `app.domainanda.com` |
| Application startup file | `server.js` (wrapper khusus di root proyek — Passenger butuh file yang membuka HTTP server sendiri, `next start` versi CLI tidak cocok dipakai langsung) |

Setelah dibuat, di halaman yang sama tambahkan **Environment Variables**:

```
DATABASE_URL=postgresql://USER:PASSWORD@HOST/DATABASE?sslmode=require
DATABASE_SSL=true
ANTHROPIC_API_KEY=sk-ant-xxxxx        (opsional, untuk fitur Literature Scanner)
CRON_SECRET=isi-string-acak-panjang   (lihat langkah 5 di bawah)
NODE_ENV=production
```

## 4. Install dependencies & build

hPanel Node.js App punya tombol **Run NPM Install** — klik itu dulu.
Setelah itu, aplikasi masih perlu di-*build* (`next build` menghasilkan
folder `.next` yang dipakai `server.js` saat runtime). Kalau paket Anda
punya akses terminal/SSH (hPanel → Advanced → SSH Access), jalankan:

```bash
cd ~/domains/app.domainanda.com/program-pelatihan-atlet   # sesuaikan path Application root
npm run build
```

Kalau tidak ada akses terminal sama sekali, build harus dilakukan di
komputer lokal (`npm run build`) lalu folder `.next` ikut di-upload
bersama kode (tambahkan ke deploy, jangan andalkan `.gitignore` yang
biasanya mengecualikan `.next`).

Setelah build selesai, klik **Restart** di halaman Node.js App.

## 5. Cron Job pengganti Vercel Cron

`vercel.json` (`crons`) cuma berlaku di Vercel. Di Hostinger, buat
Cron Job manual: hPanel → **Advanced → Cron Jobs**:

- Schedule: `0 1 * * *` (jam 1 pagi setiap hari, sesuai `vercel.json` lama)
- Command:
  ```bash
  curl -s -H "Authorization: Bearer ISI_CRON_SECRET_DI_SINI" https://app.domainanda.com/api/cron/milestone-reminders >/dev/null 2>&1
  ```
  Ganti `ISI_CRON_SECRET_DI_SINI` dengan nilai `CRON_SECRET` yang sama
  persis dengan yang diisi di environment variables Node.js App (langkah 3).
  Generate nilainya dulu kalau belum ada, mis. `openssl rand -hex 32`.

## 6. SSL & domain

hPanel biasanya otomatis menyediakan SSL gratis (Let's Encrypt) untuk
domain yang dipasang — aktifkan lewat menu **SSL** kalau belum otomatis,
lalu paksa HTTPS.

## 7. Redeploy setelah ada perubahan kode

1. Git pull (atau klik **Deploy** lagi di menu Git hPanel).
2. `npm install` (kalau ada dependency baru) + `npm run build`.
3. Klik **Restart** di halaman Node.js App.

## Troubleshooting

- **App tidak mau start / 503** → cek log di halaman Node.js App. Penyebab
  paling umum: folder `.next` belum ada (lupa `npm run build`), atau versi
  Node di bawah 20.9.
- **Gagal konek database** → pastikan `DATABASE_URL` benar & provider DB
  mengizinkan koneksi dari luar (Neon/Supabase default-nya sudah publik,
  tidak perlu whitelist IP). Kalau providernya minta SSL, jangan set
  `DATABASE_SSL=false`.
- **Reminder milestone tidak jalan otomatis** → cek Cron Job di hPanel
  benar-benar tersimpan aktif, dan `CRON_SECRET` di cron command sama
  persis dengan environment variable aplikasi.
