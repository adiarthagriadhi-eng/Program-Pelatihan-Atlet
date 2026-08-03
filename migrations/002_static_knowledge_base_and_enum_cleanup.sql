-- =====================================================================
-- MIGRASI 002: Basis Pengetahuan Statis + pembersihan skema
-- =====================================================================
-- Untuk database yang SUDAH menjalankan schema.sql versi sebelumnya
-- (sudah punya tabel athletes/training_programs/dst). JANGAN jalankan
-- schema.sql lagi ke database ini -- pakai file migrasi ini.
--
-- Isi migrasi:
--   1. Hapus 'session_duration' & 'sleep_quality' dari enum assessment_type
--      (skema baru tidak lagi memisahkannya sebagai assessment harian --
--      lihat catatan dampak di komentar dekat langkah 1 di bawah).
--   2. Hapus kolom literature_findings.caution_note (catatan kehati-hatian
--      sekarang dilebur ke kolom summary).
--   3. Tambah knowledge_sources & training_guidelines (basis pengetahuan
--      statis, menggantikan Literature Scanner real-time).
--   4. Tambah sports.knowledge_status.
--   5. Tambah index baru untuk knowledge_sources/training_guidelines.
--
-- Jalankan dengan: psql -d nama_database -f migrations/002_static_knowledge_base_and_enum_cleanup.sql
-- =====================================================================

BEGIN;

-- ---------- 1. Bersihkan assessment_type ----------
-- PostgreSQL tidak punya "ALTER TYPE ... DROP VALUE" -- caranya adalah
-- buat enum baru lalu pindahkan kolom yang memakainya. Sebelum itu, guard
-- ini menghentikan migrasi (bukan menghapus data diam-diam) kalau masih
-- ada baris assessments yang memakai kedua type yang mau dihapus --
-- tinjau/backup baris itu dulu sebelum menjalankan ulang migrasi ini.
--
-- DAMPAK: setelah migrasi ini, ACWR (lib/metrics/acwr.ts) dipindah
-- sumber datanya ke training_sessions.actual_rpe x actual_duration_minutes
-- (lewat view v_athlete_session_load) -- BUKAN lagi dari assessments.
-- Readiness Score dihitung dari 3 metrik (muscle_soreness, mood, stress)
-- tanpa komponen kualitas tidur. Lihat commit terkait untuk detail.
DO $$
DECLARE
  affected_count integer;
BEGIN
  SELECT COUNT(*) INTO affected_count
  FROM assessments
  WHERE type IN ('session_duration', 'sleep_quality');

  IF affected_count > 0 THEN
    RAISE EXCEPTION
      'Migrasi dihentikan: ada % baris di assessments dengan type session_duration/sleep_quality. '
      'Backup/pindahkan baris itu dulu (mis. export ke tabel lain) sebelum menjalankan ulang migrasi ini, '
      'supaya datanya tidak hilang diam-diam saat enum-nya diubah.',
      affected_count;
  END IF;
END $$;

ALTER TYPE assessment_type RENAME TO assessment_type_old;

CREATE TYPE assessment_type AS ENUM (
  'session_rpe', 'resting_hr', 'sleep_hours', 'wellness_score',
  'sport_specific_pr', 'hrv_optional', 'muscle_soreness', 'mood', 'stress'
);

ALTER TABLE assessments
  ALTER COLUMN type TYPE assessment_type USING type::text::assessment_type;

DROP TYPE assessment_type_old;

-- ---------- 2. Hapus literature_findings.caution_note ----------
ALTER TABLE literature_findings DROP COLUMN IF EXISTS caution_note;

-- ---------- 3. Basis Pengetahuan Statis ----------
CREATE TABLE IF NOT EXISTS knowledge_sources (
    id              SERIAL PRIMARY KEY,
    sport_id        INTEGER NOT NULL REFERENCES sports(id),
    title           TEXT NOT NULL,
    source_url      TEXT,
    source_type     VARCHAR(20) NOT NULL, -- 'manual_upload' | 'assisted_search'
    uploaded_content TEXT,
    added_by        INTEGER REFERENCES coaches(id),
    verified        BOOLEAN DEFAULT false,
    verified_at     TIMESTAMPTZ,
    created_at      TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS training_guidelines (
    id              SERIAL PRIMARY KEY,
    sport_id        INTEGER NOT NULL REFERENCES sports(id),
    source_id       INTEGER NOT NULL REFERENCES knowledge_sources(id),
    applicable_phase_type phase_type,
    topic           VARCHAR(150),
    guideline_text  TEXT NOT NULL,
    created_at      TIMESTAMPTZ DEFAULT now()
);

-- ---------- 4. sports.knowledge_status ----------
ALTER TABLE sports ADD COLUMN IF NOT EXISTS knowledge_status VARCHAR(20) DEFAULT 'under_construction';

-- ---------- 5. Index baru ----------
CREATE INDEX IF NOT EXISTS idx_training_guidelines_sport_phase ON training_guidelines(sport_id, applicable_phase_type);
CREATE INDEX IF NOT EXISTS idx_knowledge_sources_sport_verified ON knowledge_sources(sport_id) WHERE verified = true;

COMMIT;
