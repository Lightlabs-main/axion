// Plain shared constants — safe to import from both server and client components.

export const LIFECYCLE_STAGES = [
  "Predict",
  "Commit",
  "Execute",
  "Judge",
  "Forge",
  "Evolve",
] as const;

export type LifecycleStage = (typeof LIFECYCLE_STAGES)[number];
