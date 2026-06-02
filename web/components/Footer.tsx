import { AxionMark } from "./AxionMark";

export function Footer() {
  return (
    <footer className="border-t border-[var(--border)] py-8">
      <div className="mx-auto flex w-full max-w-6xl flex-col items-center justify-between gap-3 px-5 sm:flex-row sm:px-8">
        <div className="flex items-center gap-2 text-sm text-[var(--muted)]">
          <AxionMark size={20} />
          <span>Axion · self-forging agentic wallet · Mantle Turing Test Hackathon 2026</span>
        </div>
        <p className="text-xs text-[var(--muted)]">
          Demo routes are simulated and labelled. The lifecycle is real.
        </p>
      </div>
    </footer>
  );
}
