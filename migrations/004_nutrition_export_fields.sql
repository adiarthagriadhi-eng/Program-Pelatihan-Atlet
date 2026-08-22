-- =====================================================================
-- MIGRASI 004: Field untuk ekspor data nutrisi (integrasi Nutrition Engine)
-- =====================================================================
-- Jalankan SETELAH migrations/003_knowledge_status_trigger.sql.
--
-- Isi migrasi:
--   1. Tambah field antropometri & kategori/nomor spesifik di athletes
--      (weight_kg, height_cm, body_fat_percent, discipline_category,
--      event_name) -- dibutuhkan supaya profil atlet bisa dipetakan
--      1:1 ke AthleteProfile milik Nutrition Engine (lihat
--      src/lib/nutrition-export.ts).
--   2. Tambah sports.nutrition_sport_key ('atletik' | 'renang' | NULL) --
--      Nutrition Engine cuma punya logika untuk dua cabang ini (lewat
--      penyesuaian termal air untuk renang). Cabang lain di tabel sports
--      TETAP boleh ada (aplikasi ini lintas cabang olahraga), tapi
--      atletnya otomatis dikecualikan dari ekspor nutrisi selama
--      nutrition_sport_key masih NULL. Field ini diisi otomatis lewat
--      pencocokan kata kunci pada nama cabang sebagai tebakan awal --
--      TINJAU & KOREKSI MANUAL kalau tebakannya salah, mis:
--        UPDATE sports SET nutrition_sport_key = 'atletik' WHERE id = ...;
--
-- Jalankan dengan: psql -d nama_database -f migrations/004_nutrition_export_fields.sql
-- =====================================================================

BEGIN;

-- ---------- 1. Field antropometri & kategori/event di athletes ----------
ALTER TABLE athletes
    ADD COLUMN IF NOT EXISTS weight_kg NUMERIC(5,2),
    ADD COLUMN IF NOT EXISTS height_cm NUMERIC(5,1),
    ADD COLUMN IF NOT EXISTS body_fat_percent NUMERIC(4,1),
    ADD COLUMN IF NOT EXISTS discipline_category VARCHAR(100),
    ADD COLUMN IF NOT EXISTS event_name VARCHAR(150);

ALTER TABLE athletes
    ADD CONSTRAINT chk_athletes_body_fat_percent
    CHECK (body_fat_percent IS NULL OR (body_fat_percent >= 0 AND body_fat_percent <= 60));

-- ---------- 2. sports.nutrition_sport_key ----------
ALTER TABLE sports
    ADD COLUMN IF NOT EXISTS nutrition_sport_key VARCHAR(10);

ALTER TABLE sports
    ADD CONSTRAINT chk_sports_nutrition_sport_key
    CHECK (nutrition_sport_key IS NULL OR nutrition_sport_key IN ('atletik', 'renang'));

-- Tebakan awal berbasis nama cabang -- TINJAU ULANG secara manual.
UPDATE sports
SET nutrition_sport_key = 'renang'
WHERE nutrition_sport_key IS NULL
  AND (name ILIKE '%renang%' OR name ILIKE '%swim%');

UPDATE sports
SET nutrition_sport_key = 'atletik'
WHERE nutrition_sport_key IS NULL
  AND (name ILIKE '%atletik%' OR name ILIKE '%athletic%');

COMMIT;
