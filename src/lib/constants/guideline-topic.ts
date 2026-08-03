export const GUIDELINE_TOPICS = [
  "periodization",
  "load_progression",
  "taper_strategy",
  "recovery",
  "injury_prevention",
  "strength_training",
  "technique",
  "nutrition",
  "competition_prep",
  "monitoring",
] as const;

export type GuidelineTopic = (typeof GUIDELINE_TOPICS)[number];

export const GUIDELINE_TOPIC_LABELS: Record<GuidelineTopic, string> = {
  periodization: "Periodisasi",
  load_progression: "Progresi Beban Latihan",
  taper_strategy: "Strategi Taper",
  recovery: "Pemulihan",
  injury_prevention: "Pencegahan Cedera",
  strength_training: "Latihan Kekuatan",
  technique: "Teknik",
  nutrition: "Nutrisi",
  competition_prep: "Persiapan Kompetisi",
  monitoring: "Monitoring & Evaluasi",
};

// topic disimpan sebagai teks bebas (VARCHAR) di database, bukan enum --
// ini dipakai untuk menampilkan label yang lebih rapi kalau topic-nya
// salah satu tag baku; kalau bukan (mis. tag custom lama), tampilkan
// apa adanya.
export function guidelineTopicLabel(topic: string | null): string | null {
  if (!topic) return null;
  return GUIDELINE_TOPIC_LABELS[topic as GuidelineTopic] ?? topic;
}
