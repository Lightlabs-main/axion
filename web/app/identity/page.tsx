"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { AxionDemoState } from "@/types";
import { loadState } from "@/lib/storage";
import { AgentIdentityCard } from "@/components/AgentIdentityCard";
import { Timeline } from "@/components/EpochCard";
import { SectionTitle } from "@/components/ui";

export default function IdentityPage() {
  const [mounted, setMounted] = useState(false);
  const [state, setState] = useState<AxionDemoState | null>(null);

  useEffect(() => {
    setState(loadState());
    setMounted(true);
  }, []);

  if (!mounted || !state) {
    return (
      <div className="space-y-4">
        <div className="panel h-48 animate-pulse" />
        <div className="panel h-32 animate-pulse" />
      </div>
    );
  }

  const agent = state.agent;

  return (
    <div className="space-y-8">
      <div>
        <div className="label mb-1">Identity &amp; Chronos timeline</div>
        <h1 className="font-display text-3xl font-extrabold">
          The wallet&apos;s <span className="gradient-text">memory becomes trust</span>
        </h1>
        <p className="mt-1 text-sm text-[var(--muted)]">
          Every verified outcome forges the next strategy. This identity is the public, append-only
          record of that evolution.
        </p>
      </div>

      {!agent ? (
        <div className="panel p-8 text-center">
          <h2 className="font-display text-xl font-bold">No agent yet</h2>
          <p className="mx-auto mt-2 max-w-md text-sm text-[var(--muted)]">
            Initialise the Axion agent in the console and run at least one lifecycle to populate the
            identity and timeline.
          </p>
          <Link href="/console" className="btn btn-primary mx-auto mt-5 inline-flex px-6 py-3">
            Open the console →
          </Link>
        </div>
      ) : (
        <>
          <AgentIdentityCard agent={agent} />

          <section>
            <SectionTitle eyebrow="Chronos" title={`Timeline · ${state.epochs.length} epoch${state.epochs.length === 1 ? "" : "s"}`} />
            <Timeline epochs={state.epochs} />
          </section>
        </>
      )}
    </div>
  );
}
