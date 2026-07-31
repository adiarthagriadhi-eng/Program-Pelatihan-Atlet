export const PHASE_TYPES = [
  "general_prep",
  "specific_prep",
  "pre_competition",
  "competition",
  "transition",
] as const;

export type PhaseType = (typeof PHASE_TYPES)[number];

export const PHASE_TYPE_LABELS: Record<PhaseType, string> = {
  general_prep: "Persiapan Umum",
  specific_prep: "Persiapan Khusus",
  pre_competition: "Pra-Kompetisi",
  competition: "Kompetisi",
  transition: "Transisi",
};
