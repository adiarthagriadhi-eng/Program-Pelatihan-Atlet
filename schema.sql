-- =====================================================================
-- SKEMA DATABASE: Aplikasi Program Pelatihan Atlet Lintas Cabang Olahraga
-- PostgreSQL 14+
-- Referensi: blueprint-app-pelatihan-atlet.md
-- =====================================================================

-- ---------- ENUM TYPES ----------

CREATE TYPE sport_category AS ENUM ('endurance', 'strength_power', 'skill_cns', 'mixed', 'combat');
CREATE TYPE phase_type AS ENUM ('general_prep', 'specific_prep', 'pre_competition', 'competition', 'transition');
CREATE TYPE program_status AS ENUM ('draft', 'active', 'archived');
CREATE TYPE milestone_type AS ENUM ('competition', 'test_date', 'phase_transition', 'pr_target');
CREATE TYPE milestone_status AS ENUM ('pending', 'achieved', 'missed');
CREATE TYPE revision_trigger AS ENUM ('auto_literature', 'auto_load_deviation', 'manual_coach', 'prompt_driven');
CREATE TYPE revision_status AS ENUM ('pending_review', 'approved', 'rejected', 'edited_and_approved');
CREATE TYPE reminder_channel AS ENUM ('email', 'whatsapp', 'push', 'sms');
CREATE TYPE reminder_status AS ENUM ('scheduled', 'sent', 'failed');
CREATE TYPE assessment_type AS ENUM ('session_rpe', 'resting_hr', 'sleep_hours', 'wellness_score', 'sport_specific_pr', 'hrv_optional', 'muscle_soreness', 'mood', 'stress');

-- ---------- ENTITAS INTI ----------

CREATE TABLE sports (
    id              SERIAL PRIMARY KEY,
    name            VARCHAR(100) NOT NULL UNIQUE,
    category        sport_category NOT NULL,
    primary_energy_system VARCHAR(100),
    created_at      TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE coaches (
    id              SERIAL PRIMARY KEY,
    name            VARCHAR(150) NOT NULL,
    email           VARCHAR(150) UNIQUE,
    phone           VARCHAR(30),
    created_at      TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE athletes (
    id              SERIAL PRIMARY KEY,
    name            VARCHAR(150) NOT NULL,
    sport_id        INTEGER NOT NULL REFERENCES sports(id),
    coach_id        INTEGER REFERENCES coaches(id),
    birth_date      DATE,
    sex             VARCHAR(10),
    training_age_years NUMERIC(4,1),
    injury_history  JSONB DEFAULT '[]'::jsonb,  -- [{type, date, status, notes}]
    current_phase_id INTEGER,  -- FK ditambahkan setelah training_phases dibuat (lihat ALTER di bawah)
    created_at      TIMESTAMPTZ DEFAULT now(),
    updated_at      TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE training_programs (
    id              SERIAL PRIMARY KEY,
    athlete_id      INTEGER NOT NULL REFERENCES athletes(id) ON DELETE CASCADE,
    sport_id        INTEGER NOT NULL REFERENCES sports(id),
    start_date      DATE NOT NULL,
    end_date        DATE,
    macrocycle_goal TEXT,
    status          program_status DEFAULT 'draft',
    version_number  INTEGER DEFAULT 1,
    created_at      TIMESTAMPTZ DEFAULT now(),
    updated_at      TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE training_phases (
    id                  SERIAL PRIMARY KEY,
    program_id          INTEGER NOT NULL REFERENCES training_programs(id) ON DELETE CASCADE,
    phase_type          phase_type NOT NULL,
    week_number         INTEGER,
    start_date          DATE NOT NULL,
    end_date            DATE NOT NULL,
    primary_focus       TEXT,
    planned_volume      NUMERIC(6,2),      -- unit bebas: jam, km, tonase, dst -- definisikan per sport
    planned_intensity   NUMERIC(5,2),      -- skala 1-10 atau %1RM tergantung sport
    target_load_index   NUMERIC(6,2),      -- target ACWR atau load index
    created_at          TIMESTAMPTZ DEFAULT now()
);

-- Sekarang tambahkan FK current_phase_id di athletes
ALTER TABLE athletes
    ADD CONSTRAINT fk_athlete_current_phase
    FOREIGN KEY (current_phase_id) REFERENCES training_phases(id) ON DELETE SET NULL;

CREATE TABLE training_sessions (
    id              SERIAL PRIMARY KEY,
    phase_id        INTEGER NOT NULL REFERENCES training_phases(id) ON DELETE CASCADE,
    session_date    DATE NOT NULL,
    session_type    VARCHAR(100),
    planned_volume  NUMERIC(6,2),
    planned_intensity NUMERIC(5,2),
    planned_rpe     NUMERIC(3,1),
    actual_rpe      NUMERIC(3,1),
    actual_duration_minutes INTEGER,
    notes           TEXT,
    created_at      TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE assessments (
    id              SERIAL PRIMARY KEY,
    athlete_id      INTEGER NOT NULL REFERENCES athletes(id) ON DELETE CASCADE,
    assessment_date DATE NOT NULL,
    type            assessment_type NOT NULL,
    value           NUMERIC(8,2) NOT NULL,
    unit            VARCHAR(30),
    created_at      TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE milestones (
    id              SERIAL PRIMARY KEY,
    athlete_id      INTEGER NOT NULL REFERENCES athletes(id) ON DELETE CASCADE,
    program_id      INTEGER REFERENCES training_programs(id) ON DELETE CASCADE,
    target_date     DATE NOT NULL,
    milestone_type  milestone_type NOT NULL,
    description     TEXT,
    status          milestone_status DEFAULT 'pending',
    reminder_schedule_days INTEGER[] DEFAULT ARRAY[30, 7, 1],  -- H-30/H-7/H-1
    created_at      TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE literature_findings (
    id              SERIAL PRIMARY KEY,
    scan_date       DATE NOT NULL DEFAULT CURRENT_DATE,
    topic_tag       VARCHAR(150) NOT NULL,
    source_title    TEXT NOT NULL,
    source_url      TEXT,
    summary         TEXT,
    relevance_score NUMERIC(3,2),  -- 0.00 - 1.00
    created_at      TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE revision_log (
    id                  SERIAL PRIMARY KEY,
    program_id          INTEGER NOT NULL REFERENCES training_programs(id) ON DELETE CASCADE,
    triggered_by        revision_trigger NOT NULL,
    trigger_summary      TEXT,
    proposed_changes    JSONB NOT NULL,   -- {volume_delta, intensity_delta, session_type_swap, ...}
    source_citations    JSONB DEFAULT '[]'::jsonb,  -- [{finding_id, url, note}]
    status              revision_status DEFAULT 'pending_review',
    reviewed_by         INTEGER REFERENCES coaches(id),
    reviewed_at         TIMESTAMPTZ,
    created_at          TIMESTAMPTZ DEFAULT now()
);

-- Tabel penghubung many-to-many: satu revisi bisa dipicu banyak temuan literatur
CREATE TABLE revision_literature_link (
    revision_id     INTEGER NOT NULL REFERENCES revision_log(id) ON DELETE CASCADE,
    finding_id      INTEGER NOT NULL REFERENCES literature_findings(id) ON DELETE CASCADE,
    PRIMARY KEY (revision_id, finding_id)
);

CREATE TABLE prompt_queries (
    id                  SERIAL PRIMARY KEY,
    athlete_id          INTEGER NOT NULL REFERENCES athletes(id) ON DELETE CASCADE,
    coach_id            INTEGER REFERENCES coaches(id),
    prompt_text         TEXT NOT NULL,
    generated_revision_id INTEGER REFERENCES revision_log(id),
    sources_cited       JSONB DEFAULT '[]'::jsonb,
    created_at          TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE reminders_log (
    id              SERIAL PRIMARY KEY,
    milestone_id    INTEGER REFERENCES milestones(id) ON DELETE CASCADE,
    session_id      INTEGER REFERENCES training_sessions(id) ON DELETE CASCADE,
    recipient_type  VARCHAR(20) NOT NULL,  -- 'athlete' | 'coach'
    recipient_id    INTEGER NOT NULL,      -- merujuk ke athletes.id atau coaches.id
    channel         reminder_channel NOT NULL,
    scheduled_for   TIMESTAMPTZ NOT NULL,
    sent_at         TIMESTAMPTZ,
    status          reminder_status DEFAULT 'scheduled',
    created_at      TIMESTAMPTZ DEFAULT now()
);

-- ---------- INDEX PENTING (untuk performa query yang sering dipakai) ----------

CREATE INDEX idx_assessments_athlete_date ON assessments(athlete_id, assessment_date DESC);
CREATE INDEX idx_training_sessions_phase_date ON training_sessions(phase_id, session_date);
CREATE INDEX idx_milestones_target_date ON milestones(target_date) WHERE status = 'pending';
CREATE INDEX idx_revision_log_status ON revision_log(status) WHERE status = 'pending_review';
CREATE INDEX idx_literature_findings_topic ON literature_findings(topic_tag, scan_date DESC);
CREATE INDEX idx_reminders_scheduled ON reminders_log(scheduled_for) WHERE status = 'scheduled';

-- ---------- VIEW BANTU: Hitung ACWR per atlet (contoh implementasi logika 2.1 di blueprint) ----------
-- Catatan: ini contoh sederhana berbasis training_sessions.actual_rpe x actual_duration_minutes
-- Sesuaikan window function sesuai kebutuhan produksi (idealnya dihitung di backend, bukan view statis).

CREATE VIEW v_athlete_session_load AS
SELECT
    ts.id AS session_id,
    tp.program_id,
    p.athlete_id,
    ts.session_date,
    (ts.actual_rpe * ts.actual_duration_minutes) AS session_load
FROM training_sessions ts
JOIN training_phases tp ON ts.phase_id = tp.id
JOIN training_programs p ON tp.program_id = p.id
WHERE ts.actual_rpe IS NOT NULL AND ts.actual_duration_minutes IS NOT NULL;

-- =====================================================================
-- REVISI ARSITEKTUR: Basis Pengetahuan Statis (menggantikan Literature
-- Scanner real-time, karena ditemukan risiko hallucination pada
-- pencarian web live). Ditambahkan setelah evaluasi Tahap 5.
-- =====================================================================

CREATE TABLE knowledge_sources (
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

CREATE TABLE training_guidelines (
    id              SERIAL PRIMARY KEY,
    sport_id        INTEGER NOT NULL REFERENCES sports(id),
    source_id       INTEGER NOT NULL REFERENCES knowledge_sources(id),
    applicable_phase_type phase_type,
    topic           VARCHAR(150),
    guideline_text  TEXT NOT NULL,
    created_at      TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE sports ADD COLUMN knowledge_status VARCHAR(20) DEFAULT 'under_construction';

CREATE INDEX idx_training_guidelines_sport_phase ON training_guidelines(sport_id, applicable_phase_type);
CREATE INDEX idx_knowledge_sources_sport_verified ON knowledge_sources(sport_id) WHERE verified = true;

-- =====================================================================
-- SELESAI. Cara pakai:
--   psql -d nama_database -f schema.sql   (HANYA untuk database KOSONG/baru)
--
-- Untuk database yang SUDAH menjalankan versi schema.sql sebelumnya
-- (sudah punya tabel-tabel di atas), JANGAN jalankan ulang file ini --
-- akan gagal karena tipe/tabel sudah ada. Pakai file migrasi di
-- migrations/002_static_knowledge_base_and_enum_cleanup.sql, yang
-- mengubah database yang sudah berjalan supaya sesuai definisi ini
-- (termasuk menghapus session_duration/sleep_quality dari
-- assessment_type dan caution_note dari literature_findings).
-- =====================================================================
