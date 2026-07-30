import { Pool } from "pg";

declare global {
  // eslint-disable-next-line no-var
  var pgPool: Pool | undefined;
}

function createPool() {
  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    throw new Error(
      "DATABASE_URL belum diatur. Isi file .env.local berdasarkan .env.example."
    );
  }

  return new Pool({
    connectionString,
    ssl: process.env.DATABASE_SSL === "false" ? false : { rejectUnauthorized: false },
  });
}

// Pool dibuat baru pertama kali benar-benar dipakai (bukan saat file
// diimpor), supaya proses build tidak butuh DATABASE_URL. Disimpan di
// global agar dev-reload Next.js tidak membuat koneksi baru berulang-ulang.
export function getPool(): Pool {
  if (!global.pgPool) {
    global.pgPool = createPool();
  }
  return global.pgPool;
}
