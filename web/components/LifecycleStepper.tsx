"use client";

import { LIFECYCLE_STAGES, type LifecycleStage } from "@/lib/lifecycle";

export { LIFECYCLE_STAGES };
export type { LifecycleStage };

export function LifecycleStepper({ current }: { current: number }) {
  return (
    <div className="panel p-4">
      <div className="flex items-center justify-between gap-1 overflow-x-auto">
        {LIFECYCLE_STAGES.map((stage, i) => {
          const done = i < current;
          const active = i === current;
          return (
            <div key={stage} className="flex flex-1 items-center">
              <div className="flex flex-col items-center gap-2">
                <div
                  className={`flex h-9 w-9 items-center justify-center rounded-full border text-xs font-bold transition-all ${
                    active
                      ? "border-[var(--teal)] text-[var(--teal-glow)] animate-pulse-ring bg-[rgba(45,212,191,0.12)]"
                      : done
                      ? "border-[var(--teal)] bg-[var(--teal)] text-[#04110f]"
                      : "border-[var(--border)] text-[var(--muted)]"
                  }`}
                >
                  {done ? "✓" : i + 1}
                </div>
                <span
                  className={`whitespace-nowrap text-[11px] font-semibold ${
                    active || done ? "text-[var(--text)]" : "text-[var(--muted)]"
                  }`}
                >
                  {stage}
                </span>
              </div>
              {i < LIFECYCLE_STAGES.length - 1 && (
                <div className="mx-1 h-px flex-1 self-start mt-4">
                  <div
                    className={`h-px w-full ${
                      done ? "bg-[var(--teal)]" : "bg-[var(--border)]"
                    }`}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
