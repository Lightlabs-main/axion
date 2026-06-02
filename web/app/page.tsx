import Link from "next/link";
import { AxionMark } from "@/components/AxionMark";
import { LIFECYCLE_STAGES } from "@/lib/lifecycle";

const LIFECYCLE_DETAIL: Record<string, string> = {
  Predict: "Turn the goal into multiple decision branches with explicit risk and confidence.",
  Commit: "Hash the whole decision tree and commit it on-chain before any action.",
  Execute: "Run the selected branch through approved skills with hard safety gates.",
  Judge: "Compare the real outcome against the committed prediction. No retconning.",
  Forge: "Rewrite strategy weights from the verified result — this is EchoForge.",
  Evolve: "Update trust score, permissions, memory root and strategy version.",
};

export default function HomePage() {
  return (
    <div className="space-y-20">
      {/* Hero */}
      <section className="relative pt-10">
        <div className="mx-auto max-w-3xl text-center">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-[var(--border)] bg-black/20 px-4 py-1.5 text-xs font-semibold text-[var(--muted)]">
            <span className="h-1.5 w-1.5 rounded-full bg-[var(--teal)] glow-dot" />
            Mantle Turing Test Hackathon · Agentic Wallets &amp; Economy
          </div>
          <h1 className="font-display text-4xl font-extrabold leading-[1.05] sm:text-6xl">
            An AI wallet that <span className="gradient-text">cannot rewrite</span> its reasoning.
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-[var(--muted)]">
            Most AI wallets act first and explain later. Axion commits before it acts — it predicts,
            commits, executes, judges, forges, and evolves in public.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Link href="/console" className="btn btn-primary px-6 py-3 text-base">
              Launch Demo →
            </Link>
            <Link href="/about" className="btn btn-ghost px-6 py-3 text-base">
              How it works
            </Link>
          </div>
          <div className="mt-4 text-xs text-[var(--muted)]">
            Runs fully in local demo mode — no wallet or API key required.
          </div>
        </div>

        <div className="mx-auto mt-14 flex max-w-4xl flex-wrap items-center justify-center gap-2">
          {LIFECYCLE_STAGES.map((s, i) => (
            <div key={s} className="flex items-center gap-2">
              <span className="rounded-lg border border-[var(--border)] bg-black/20 px-3 py-1.5 text-sm font-semibold">
                {s}
              </span>
              {i < LIFECYCLE_STAGES.length - 1 && <span className="text-[var(--muted)]">→</span>}
            </div>
          ))}
        </div>
      </section>

      {/* Problem / Solution */}
      <section className="grid gap-5 md:grid-cols-2">
        <div className="panel p-7">
          <div className="label mb-3 text-[var(--rose)]">The problem</div>
          <h2 className="font-display text-2xl font-bold">AI wallets are black boxes</h2>
          <p className="mt-3 leading-relaxed text-[var(--muted)]">
            AI wallets are starting to manage real on-chain value, but most still execute first and
            explain later. Users cannot verify what the agent predicted, what options it considered,
            what risks it ignored, or whether it actually learned. In Web3 one bad approval, route,
            or contract call can cost real funds.
          </p>
        </div>
        <div className="panel p-7" style={{ borderColor: "var(--border-strong)" }}>
          <div className="label mb-3 text-[var(--teal-glow)]">The Axion approach</div>
          <h2 className="font-display text-2xl font-bold">Reasoning you can verify</h2>
          <p className="mt-3 leading-relaxed text-[var(--muted)]">
            Axion turns every wallet action into a verifiable intelligence cycle. Before acting it
            builds multiple decision paths and commits their hashes on-chain. After execution it
            compares reality with its committed prediction, writes a post-mortem into ERC-8004
            memory, and forges the next strategy version. It cannot fake its reasoning after the
            fact.
          </p>
        </div>
      </section>

      {/* Lifecycle detail */}
      <section>
        <div className="mb-6 text-center">
          <div className="label mb-2">The lifecycle</div>
          <h2 className="font-display text-3xl font-bold">
            Every goal becomes a <span className="gradient-text">judged epoch</span>
          </h2>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {LIFECYCLE_STAGES.map((s, i) => (
            <div key={s} className="panel panel-hover p-5">
              <div className="flex items-center gap-3">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg border border-[var(--border-strong)] font-mono text-sm font-bold text-[var(--teal-glow)]">
                  {i + 1}
                </span>
                <h3 className="font-display text-lg font-bold">{s}</h3>
              </div>
              <p className="mt-3 text-sm leading-relaxed text-[var(--muted)]">
                {LIFECYCLE_DETAIL[s]}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* Thesis lines */}
      <section className="grid gap-4 md:grid-cols-3">
        {[
          "Every goal becomes a decision tree.",
          "Every execution becomes a judged epoch.",
          "Every outcome forges the next strategy.",
        ].map((line) => (
          <div key={line} className="panel p-6 text-center">
            <p className="font-display text-lg font-semibold leading-snug">{line}</p>
          </div>
        ))}
      </section>

      {/* CTA */}
      <section className="panel relative overflow-hidden p-10 text-center">
        <div className="mx-auto max-w-2xl">
          <div className="mb-5 flex justify-center">
            <AxionMark size={40} />
          </div>
          <h2 className="font-display text-3xl font-bold">
            A wallet that proves how it thinks
          </h2>
          <p className="mt-3 text-[var(--muted)]">
            Axion is not just an AI wallet. It is a wallet that proves how it thinks, learns from
            outcomes, and earns trust over time. Its memory is not cosmetic — it changes the
            wallet&apos;s future permissions, trust score, and strategy version.
          </p>
          <Link href="/console" className="btn btn-primary mt-7 px-6 py-3 text-base">
            Open the Agent Console →
          </Link>
        </div>
      </section>
    </div>
  );
}
