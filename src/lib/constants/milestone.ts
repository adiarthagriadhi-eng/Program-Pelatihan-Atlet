export const MILESTONE_TYPES = [
  "competition",
  "test_date",
  "phase_transition",
  "pr_target",
] as const;

export type MilestoneType = (typeof MILESTONE_TYPES)[number];

export const MILESTONE_TYPE_LABELS: Record<MilestoneType, string> = {
  competition: "Kompetisi",
  test_date: "Tanggal Tes",
  phase_transition: "Transisi Fase",
  pr_target: "Target PR",
};
