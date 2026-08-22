import { getPool } from "@/lib/db";
import { PHASE_TYPE_LABELS, type PhaseType } from "@/lib/constants/phase";
import {
  NUTRITION_EXPORT_FORMAT_VERSION,
  NUTRITION_EXPORT_SOURCE_APP,
  NUTRITION_PHASE_KEY_BY_PHASE_TYPE,
  classifyTrainingIntensity,
  mapSexToNutritionCode,
  type NutritionPhaseKey,
  type NutritionSportKey,
  type NutritionTrainingIntensity,
} from "@/lib/constants/nutrition-export";

const WEEKLY_SESSION_WINDOW_DAYS = 7;
// Sesi dianggap berada di jendela "carb loading" 36-48j pra-kompetisi kalau
// jaraknya ke milestone kompetisi/tes berikutnya 1-2 hari kalender --
// granularitas tanggal (bukan jam) di skema milestones membuat ini sebuah
// pendekatan, bukan perhitungan jam yang presisi.
const CARB_LOADING_DAYS_BEFORE_MILESTONE = [1, 2];
const FALLBACK_TRAINING_DURATION_MIN = 60;

export type NutritionProfileExport = {
  sex: "L" | "P";
  age: number | null;
  weightKg: number | null;
  heightCm: number | null;
  bodyFatPercent: number | null;
  sport: NutritionSportKey;
  event: string;
};

export type NutritionWeeklySessionExport = {
  day: string;
  sessionName: string;
  trainingDurationMin: number;
  trainingDurationEstimatePrecise: boolean;
  trainingIntensity: NutritionTrainingIntensity;
  intensityPositionInPhase: number;
  isCarbLoading: boolean;
  sourceRPE: number | null;
};

export type NutritionAthleteExport = {
  athleteName: string;
  athleteId: number;
  sport: NutritionSportKey;
  category: string;
  event: string;
  phaseKey: NutritionPhaseKey;
  phaseLabel: string | null;
  profile: NutritionProfileExport;
  weeklySessions: NutritionWeeklySessionExport[];
};

export type NutritionExportPayload = {
  formatVersion: "1.0";
  exportedAt: string;
  sourceApp: string;
  limitations: string[];
  athletes: NutritionAthleteExport[];
};

export type ExcludedAthlete = {
  athleteId: number;
  athleteName: string;
  reason: string;
};

export type NutritionExportResult = {
  payload: NutritionExportPayload;
  excludedAthletes: ExcludedAthlete[];
};

type EligibleAthleteRow = {
  id: number;
  name: string;
  sex: string | null;
  birth_date: string | null;
  weight_kg: string | null;
  height_cm: string | null;
  body_fat_percent: string | null;
  discipline_category: string | null;
  event_name: string | null;
  sport_name: string;
  nutrition_sport_key: NutritionSportKey | null;
  phase_id: number | null;
  phase_type: PhaseType | null;
};

type SessionRow = {
  session_date: string;
  session_type: string | null;
  actual_duration_minutes: number | null;
  actual_rpe: string | null;
  planned_rpe: string | null;
  planned_intensity: string | null;
};

type MilestoneRow = {
  target_date: string;
};

function calculateAge(birthDate: string | null): number | null {
  if (!birthDate) return null;
  const birth = new Date(birthDate);
  if (Number.isNaN(birth.getTime())) return null;

  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const hasNotHadBirthdayThisYear =
    today.getMonth() < birth.getMonth() ||
    (today.getMonth() === birth.getMonth() && today.getDate() < birth.getDate());
  if (hasNotHadBirthdayThisYear) age -= 1;
  return age;
}

function toNumberOrNull(value: string | null): number | null {
  if (value == null) return null;
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
}

function dayNameId(dateStr: string): string {
  const date = new Date(dateStr);
  if (Number.isNaN(date.getTime())) return dateStr;
  return date.toLocaleDateString("id-ID", { weekday: "long" });
}

function intensityPositionFromPhase(plannedIntensity: string | null): {
  value: number;
  usedDefault: boolean;
} {
  const num = toNumberOrNull(plannedIntensity);
  if (num == null) return { value: 0.5, usedDefault: true };
  const normalized = num / 10;
  return { value: Math.min(1, Math.max(0, normalized)), usedDefault: false };
}

function daysBetween(fromDateStr: string, toDateStr: string): number {
  const from = new Date(fromDateStr);
  const to = new Date(toDateStr);
  return Math.round((to.getTime() - from.getTime()) / (1000 * 60 * 60 * 24));
}

/**
 * Membangun paket ekspor untuk Nutrition Engine eksternal, sesuai kontrak
 * di export-spec/nutrition-export-schema.json (formatVersion 1.0).
 * Hanya atlet dengan sports.nutrition_sport_key terisi ('atletik'/'renang')
 * DAN punya fase latihan aktif saat ini yang disertakan -- sisanya masuk
 * `excludedAthletes` dengan alasannya, tidak diam-diam dilewati.
 */
export async function buildNutritionExport(
  athleteIds?: number[]
): Promise<NutritionExportResult> {
  const pool = getPool();

  const { rows: candidates } = await pool.query<EligibleAthleteRow>(
    `
    SELECT
      a.id, a.name, a.sex, a.birth_date,
      a.weight_kg, a.height_cm, a.body_fat_percent,
      a.discipline_category, a.event_name,
      s.name AS sport_name, s.nutrition_sport_key,
      tp.id AS phase_id, tp.phase_type
    FROM athletes a
    JOIN sports s ON a.sport_id = s.id
    LEFT JOIN training_phases tp ON a.current_phase_id = tp.id
    ${athleteIds && athleteIds.length > 0 ? "WHERE a.id = ANY($1::int[])" : ""}
    ORDER BY a.name
    `,
    athleteIds && athleteIds.length > 0 ? [athleteIds] : []
  );

  const excludedAthletes: ExcludedAthlete[] = [];
  const athletes: NutritionAthleteExport[] = [];

  let anyMissingBodyFat = false;
  let anyImpreciseDuration = false;
  let anyDefaultIntensityPosition = false;
  let anyFallbackEvent = false;

  for (const row of candidates) {
    if (!row.nutrition_sport_key) {
      excludedAthletes.push({
        athleteId: row.id,
        athleteName: row.name,
        reason: `Cabang olahraga "${row.sport_name}" belum dipetakan ke atletik/renang (sports.nutrition_sport_key kosong).`,
      });
      continue;
    }

    if (!row.phase_id || !row.phase_type) {
      excludedAthletes.push({
        athleteId: row.id,
        athleteName: row.name,
        reason: "Atlet tidak punya fase latihan aktif saat ini (athletes.current_phase_id kosong).",
      });
      continue;
    }

    const sexCode = mapSexToNutritionCode(row.sex);
    if (!sexCode) {
      excludedAthletes.push({
        athleteId: row.id,
        athleteName: row.name,
        reason: "Jenis kelamin belum/tidak valid untuk pemetaan L/P.",
      });
      continue;
    }

    const [{ rows: sessions }, { rows: milestones }] = await Promise.all([
      pool.query<SessionRow>(
        `
        SELECT session_date, session_type, actual_duration_minutes,
               actual_rpe, planned_rpe, planned_intensity
        FROM training_sessions
        WHERE phase_id = $1
          AND session_date >= CURRENT_DATE - ($2 * INTERVAL '1 day')
          AND session_date <= CURRENT_DATE
        ORDER BY session_date
        `,
        [row.phase_id, WEEKLY_SESSION_WINDOW_DAYS - 1]
      ),
      pool.query<MilestoneRow>(
        `
        SELECT target_date
        FROM milestones
        WHERE athlete_id = $1
          AND milestone_type IN ('competition', 'test_date')
          AND status = 'pending'
        `,
        [row.id]
      ),
    ]);

    const weeklySessions: NutritionWeeklySessionExport[] = sessions.map((session) => {
      const sourceRPE = toNumberOrNull(session.actual_rpe) ?? toNumberOrNull(session.planned_rpe);
      const trainingIntensity = classifyTrainingIntensity(sourceRPE);
      const precise = session.actual_duration_minutes != null;
      if (!precise) anyImpreciseDuration = true;

      const { value: intensityPositionInPhase, usedDefault } = intensityPositionFromPhase(
        session.planned_intensity
      );
      if (usedDefault) anyDefaultIntensityPosition = true;

      const isCarbLoading = milestones.some((m) => {
        const diff = daysBetween(session.session_date, m.target_date);
        return CARB_LOADING_DAYS_BEFORE_MILESTONE.includes(diff);
      });

      return {
        day: dayNameId(session.session_date),
        sessionName: session.session_type ?? "Sesi Latihan",
        trainingDurationMin: session.actual_duration_minutes ?? FALLBACK_TRAINING_DURATION_MIN,
        trainingDurationEstimatePrecise: precise,
        trainingIntensity,
        intensityPositionInPhase,
        isCarbLoading,
        sourceRPE,
      };
    });

    const bodyFatPercent = toNumberOrNull(row.body_fat_percent);
    if (bodyFatPercent == null) anyMissingBodyFat = true;

    const category = row.discipline_category ?? row.sport_name;
    const event = row.event_name ?? row.sport_name;
    if (!row.event_name) anyFallbackEvent = true;

    athletes.push({
      athleteName: row.name,
      athleteId: row.id,
      sport: row.nutrition_sport_key,
      category,
      event,
      phaseKey: NUTRITION_PHASE_KEY_BY_PHASE_TYPE[row.phase_type],
      phaseLabel: PHASE_TYPE_LABELS[row.phase_type],
      profile: {
        sex: sexCode,
        age: calculateAge(row.birth_date),
        weightKg: toNumberOrNull(row.weight_kg),
        heightCm: toNumberOrNull(row.height_cm),
        bodyFatPercent,
        sport: row.nutrition_sport_key,
        event,
      },
      weeklySessions,
    });
  }

  const limitations: string[] = [
    "weeklySessions merepresentasikan 7 hari terakhir yang tercatat di sistem sumber (bukan proyeksi ke depan).",
  ];

  if (anyMissingBodyFat) {
    limitations.push(
      "Sebagian atlet belum punya data body fat % -- nutrition-engine akan fallback ke formula Mifflin-St Jeor (bukan Cunningham) untuk atlet tersebut, dan status REDs akan 'unknown'."
    );
  }
  if (anyImpreciseDuration) {
    limitations.push(
      `Sebagian sesi belum punya actual_duration_minutes tercatat -- durasinya memakai nilai default ${FALLBACK_TRAINING_DURATION_MIN} menit (trainingDurationEstimatePrecise: false).`
    );
  }
  if (anyDefaultIntensityPosition) {
    limitations.push(
      "intensityPositionInPhase diturunkan dari training_phases.planned_intensity/10 (asumsi skala 1-10); kalau fase tidak punya planned_intensity, dipakai nilai tengah default 0.5."
    );
  }
  if (anyFallbackEvent) {
    limitations.push(
      "Sebagian atlet belum mengisi kategori/nomor spesifik (event_name) -- nama cabang olahraga dipakai sebagai fallback untuk field category/event."
    );
  }
  if (excludedAthletes.length > 0) {
    limitations.push(
      `${excludedAthletes.length} atlet dikecualikan dari ekspor ini -- lihat excludedAthletes untuk alasannya masing-masing.`
    );
  }

  return {
    payload: {
      formatVersion: NUTRITION_EXPORT_FORMAT_VERSION,
      exportedAt: new Date().toISOString(),
      sourceApp: NUTRITION_EXPORT_SOURCE_APP,
      limitations,
      athletes,
    },
    excludedAthletes,
  };
}
