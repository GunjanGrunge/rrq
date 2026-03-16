// apps/web/lib/pipeline-steps.ts

export const STEPS = [
  { number: 1, label: "Research" },
  { number: 2, label: "Script" },
  { number: 3, label: "SEO" },
  { number: 4, label: "Quality" },
  { number: 5, label: "Audio" },
  { number: 6, label: "Avatar" },
  { number: 7, label: "B-Roll" },
  { number: 8, label: "Images" },
  { number: 9, label: "Visuals" },
  { number: 10, label: "AV Sync" },
  { number: 11, label: "Vera QA" },
  { number: 12, label: "Shorts" },
  { number: 13, label: "Upload" },
];

export const STEP_SLUGS: Record<number, string> = {
  1: "research", 2: "script", 3: "seo", 4: "quality",
  5: "audio", 6: "avatar", 7: "broll", 8: "images", 9: "visuals",
  10: "av-sync", 11: "vera-qa", 12: "shorts", 13: "upload",
};
