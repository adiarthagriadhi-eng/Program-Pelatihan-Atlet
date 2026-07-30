import { readFileSync } from "fs";
import { join } from "path";
import { Pool } from "pg";
import "dotenv/config";

// Menjalankan file schema.sql (di root project) terhadap DATABASE_URL.
// Pakai: npm run db:schema
async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error(
      "DATABASE_URL belum diatur. Isi dulu di file .env.local (lihat .env.example)."
    );
  }

  const schemaPath = join(process.cwd(), "schema.sql");
  const sql = readFileSync(schemaPath, "utf-8");

  const pool = new Pool({
    connectionString,
    ssl: process.env.DATABASE_SSL === "false" ? false : { rejectUnauthorized: false },
  });

  console.log(`Menjalankan ${schemaPath} ...`);
  await pool.query(sql);
  console.log("Selesai. Skema berhasil dijalankan.");
  await pool.end();
}

main().catch((error) => {
  console.error("Gagal menjalankan schema.sql:");
  console.error(error);
  process.exit(1);
});
