import Link from "next/link";
import { AxionCompanion } from "@/components/AxionCompanion";
import { LIFECYCLE_STAGES } from "@/lib/lifecycle";

const GOALS = [
  "Help me grow a house fund with moderate risk.",
  "Earn steady yield while keeping emergency liquidity.",
  "Avoid unsafe approvals and explain every move.",
];

const CONSUMER_FEATURES = [
  {
    title: "Talk in goals",
    body: "Axion turns plain-language financial goals into structured decision trees with risk, yield and safety branches.",
  },
  {
    title: "See why",
    body: "Every important action has a Why view: selected branch, rejected alternatives, hashes and explorer links.",
  },
  {
    title: "Watch it evolve",
    body: "Each judged epoch forges a visible strategy upgrade tied to the agent identity and memory root.",
  },
];

export default function HomePage() {
  return (
    <div className="space-y-16">
      <section className="grid min-h-[calc(100vh-210px)] items-center gap-8 lg:grid-cols-[1.05fr_0.95fr]">
        <div>
          <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-[var(--border)] bg-black/20 px-4 py-1.5 text-xs font-semibold text-[var(--muted)]">
            <span className="h-1.5 w-1.5 rounded-full bg-[var(--teal)] glow-dot" />
            Personal agentic wallet on Mantle
          </div>
          <h1 className="font-display text-4xl font-extrabold leading-[1.05] sm:text-6xl">
            Meet the AI financial companion that{" "}
            <span className="gradient-text">proves its work</span>.
          </h1>
          <p className="mt-6 max-w-2xl text-lg leading-relaxed text-[var(--muted)]">
            Axion turns life goals into transparent on-chain strategies, executes through guarded
            skills, and visibly evolves after every judged epoch.
          </p>

          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Link href="/console" className="btn btn-primary px-6 py-3 text-base">
              Start with a goal
            </Link>
            <Link href="/identity" className="btn btn-ghost px-6 py-3 text-base">
              View identity
            </Link>
          </div>

          <div className="mt-8 grid gap-2">
            {GOALS.map((goal) => (
              <div
                key={goal}
                className="rounded-xl border border-[var(--border)] bg-black/20 px-4 py-3 text-sm text-[var(--text)]"
              >
                <span className="text-[var(--muted)]">Try: </span>
                {goal}
              </div>
            ))}
          </div>
        </div>

        <AxionCompanion mood="thinking" />
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        {CONSUMER_FEATURES.map((feature) => (
          <div key={feature.title} className="panel panel-hover p-6">
            <h2 className="font-display text-xl font-bold">{feature.title}</h2>
            <p className="mt-3 text-sm leading-relaxed text-[var(--muted)]">{feature.body}</p>
          </div>
        ))}
      </section>

      <section className="panel p-7">
        <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
          <div>
            <div className="label mb-2">Verifiable agent loop</div>
            <h2 className="font-display text-3xl font-bold">
              Friendly on the surface. Serious underneath.
            </h2>
          </div>
          <Link href="/about" className="btn btn-ghost">
            How it works
          </Link>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
          {LIFECYCLE_STAGES.map((stage, index) => (
            <div key={stage} className="rounded-xl border border-[var(--border)] bg-black/20 p-4">
              <div className="mono text-xs text-[var(--teal-glow)]">0{index + 1}</div>
              <div className="mt-2 font-display text-lg font-bold">{stage}</div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
