-- =====================================================================
-- MIGRASI 003: Trigger otomatis untuk sports.knowledge_status
-- =====================================================================
-- Jalankan SETELAH migrations/002_static_knowledge_base_and_enum_cleanup.sql
-- (butuh tabel knowledge_sources & training_guidelines sudah ada).
--
-- sports.knowledge_status otomatis:
--   'ready'              -- ada >=1 training_guidelines untuk cabor itu
--                            yang knowledge_sources sumbernya verified=true
--   'under_construction' -- selain itu (termasuk kalau sumbernya sempat
--                            di-unverify lagi atau guideline-nya dihapus)
--
-- Dipicu dari dua arah: perubahan pada training_guidelines (tambah/ubah/
-- hapus), dan perubahan status verified/penghapusan pada knowledge_sources
-- (karena status 'ready' bergantung transitif pada keduanya).
--
-- Jalankan dengan: psql -d nama_database -f migrations/003_knowledge_status_trigger.sql
-- =====================================================================

BEGIN;

CREATE OR REPLACE FUNCTION refresh_sport_knowledge_status(p_sport_id integer) RETURNS void AS $$
BEGIN
  UPDATE sports
  SET knowledge_status = CASE
    WHEN EXISTS (
      SELECT 1
      FROM training_guidelines tg
      JOIN knowledge_sources ks ON ks.id = tg.source_id
      WHERE tg.sport_id = p_sport_id AND ks.verified = true
    ) THEN 'ready'
    ELSE 'under_construction'
  END
  WHERE id = p_sport_id;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION trg_training_guidelines_knowledge_status() RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM refresh_sport_knowledge_status(OLD.sport_id);
    RETURN OLD;
  END IF;

  PERFORM refresh_sport_knowledge_status(NEW.sport_id);
  IF TG_OP = 'UPDATE' AND OLD.sport_id IS DISTINCT FROM NEW.sport_id THEN
    PERFORM refresh_sport_knowledge_status(OLD.sport_id);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_guidelines_after_change ON training_guidelines;
CREATE TRIGGER trg_guidelines_after_change
AFTER INSERT OR UPDATE OR DELETE ON training_guidelines
FOR EACH ROW EXECUTE FUNCTION trg_training_guidelines_knowledge_status();

CREATE OR REPLACE FUNCTION trg_knowledge_sources_status_change() RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM refresh_sport_knowledge_status(OLD.sport_id);
    RETURN OLD;
  END IF;

  IF TG_OP = 'INSERT' OR OLD.verified IS DISTINCT FROM NEW.verified THEN
    PERFORM refresh_sport_knowledge_status(NEW.sport_id);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sources_after_change ON knowledge_sources;
CREATE TRIGGER trg_sources_after_change
AFTER INSERT OR UPDATE OR DELETE ON knowledge_sources
FOR EACH ROW EXECUTE FUNCTION trg_knowledge_sources_status_change();

-- Sinkronkan status untuk data yang mungkin sudah ada sebelum trigger ini
-- terpasang (no-op kalau database masih kosong).
DO $$
DECLARE
  s RECORD;
BEGIN
  FOR s IN SELECT id FROM sports LOOP
    PERFORM refresh_sport_knowledge_status(s.id);
  END LOOP;
END $$;

COMMIT;
