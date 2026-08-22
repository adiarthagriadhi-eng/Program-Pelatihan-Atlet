import type { PhaseType } from "./phase";

export const NUTRITION_EXPORT_FORMAT_VERSION = "1.0";
export const NUTRITION_EXPORT_SOURCE_APP = "Program Pelatihan Atlet";

export type NutritionSportKey = "atletik" | "renang";
export type NutritionPhaseKey = "umum" | "khusus" | "puncak" | "transisi";
export type NutritionTrainingIntensity = "low" | "moderate" | "high";

// Model 4-fase Nutrition Engine (umum -> khusus -> puncak -> transisi)
// dipetakan dari 5 phase_type aplikasi ini -- lihat EXPORT-SPEC.md poin 3.
export const NUTRITION_PHASE_KEY_BY_PHASE_TYPE: Record<PhaseType, NutritionPhaseKey> = {
  general_prep: "umum",
  specific_prep: "khusus",
  pre_competition: "puncak",
  competition: "puncak",
  transition: "transisi",
};

export function classifyTrainingIntensity(rpe: number | null): NutritionTrainingIntensity {
  if (rpe == null) return "moderate";
  if (rpe < 5) return "low";
  if (rpe < 8) return "moderate";
  return "high";
}

export function mapSexToNutritionCode(sex: string | null): "L" | "P" | null {
  if (sex === "Laki-laki") return "L";
  if (sex === "Perempuan") return "P";
  return null;
}
