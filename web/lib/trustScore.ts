import type { PermissionLevel, Verdict } from "@/types";

export const START_TRUST_SCORE = 70;

export const TRUST_DELTAS: Record<Verdict, number> = {
  Correct: 5,
  PartiallyCorrect: 2,
  RejectedSafely: 4,
  Wrong: -8,
  UnsafeBlocked: 3,
};

/** Critical failure is applied on top of a Wrong verdict for catastrophic outcomes. */
export const CRITICAL_FAILURE_DELTA = -15;

export function clampScore(score: number): number {
  return Math.max(0, Math.min(100, Math.round(score)));
}

export function applyTrustDelta(current: number, verdict: Verdict, critical = false): {
  next: number;
  delta: number;
} {
  let delta = TRUST_DELTAS[verdict];
  if (critical) delta = CRITICAL_FAILURE_DELTA;
  const next = clampScore(current + delta);
  return { next, delta: next - current };
}

export function permissionLevel(score: number): PermissionLevel {
  if (score >= 85) return "Higher autonomous limit";
  if (score >= 70) return "Execute low-value actions";
  if (score >= 50) return "Suggest actions only";
  return "Read-only / simulation only";
}

/** 0..3 numeric tier used for UI progress visuals. */
export function permissionTier(score: number): number {
  if (score >= 85) return 3;
  if (score >= 70) return 2;
  if (score >= 50) return 1;
  return 0;
}
