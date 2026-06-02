"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import type {
  AgentIdentity,
  AxionDemoState,
  Commitment,
  DecisionTree,
  ExecutionResult,
  PostMortem,
} from "@/types";
import {
  addCommitment,
  addEpoch,
  addTree,
  loadState,
  resetState,
  saveState,
  withAgent,
  withPolicy,
  withStrategy,
} from "@/lib/storage";
import { generateDecisionTree } from "@/lib/decisionTree";
import { LocalByrealAdapter, executeBranch } from "@/lib/byrealAdapter";
import { judgeAndForge, type JudgeForgeResult } from "@/lib/agentEngine";
import {
  canTransactOnchain,
  commitDecisionTreeOnchain,
  connectWallet,
  hasInjectedWallet,
  registerAgentOnchain,
  writeEpochOnchain,
} from "@/lib/contractClient";
import { isOnchainConfigured, txExplorerLink } from "@/lib/config";
import { ZERO_ROOT } from "@/lib/hashing";
import { START_TRUST_SCORE } from "@/lib/trustScore";
import { LifecycleStepper } from "@/components/LifecycleStepper";
import { DecisionTreeView } from "@/components/DecisionTree";
import { PolicyCard } from "@/components/PolicyCard";
import { ExecutionView } from "@/components/ExecutionView";
import { EpochView } from "@/components/EpochView";
import { SectionTitle, Badge } from "@/components/ui";

const DEMO_GOAL =
  "Use 100 test USDC to find a low-risk yield opportunity on Mantle. Avoid unsafe approvals and high slippage.";

const adapter = new LocalByrealAdapter();

export default function ConsolePage() {
  const [mounted, setMounted] = useState(false);
  const [state, setState] = useState<AxionDemoState | null>(null);
  const [goal, setGoal] = useState(DEMO_GOAL);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  // Ephemeral lifecycle working state (current run).
  const [tree, setTree] = useState<DecisionTree | null>(null);
  const [commitment, setCommitment] = useState<Commitment | null>(null);
  const [execution, setExecution] = useState<ExecutionResult | null>(null);
  const [judged, setJudged] = useState<JudgeForgeResult | null>(null);
  const [persisted, setPersisted] = useState(false);

  const resultRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setState(loadState());
    setMounted(true);
  }, []);

  function persist(next: AxionDemoState) {
    setState(next);
    saveState(next);
  }

  const current = useMemo(() => {
    if (!tree) return 0;
    if (!commitment) return 1;
    if (!execution) return 2;
    if (!judged) return 3;
    if (!persisted) return 4;
    return 6;
  }, [tree, commitment, execution, judged, persisted]);

  if (!mounted || !state) {
    return (
      <div className="space-y-4">
        <div className="panel h-24 animate-pulse" />
        <div className="panel h-64 animate-pulse" />
      </div>
    );
  }

  const agent = state.agent;
  const selectedBranch = tree?.branches.find((b) => b.id === tree.selectedBranchId);

  async function initAgent() {
    setError(null);
    setBusy("init");
    try {
      let owner = "local";
      let mode: "local" | "onchain" = "local";
      let txHash: string | undefined;
      const metadataURI = "ipfs://axion-agent/erc8004.json";

      if (canTransactOnchain()) {
        const account = await connectWallet();
        if (account) {
          owner = account;
          const res = await registerAgentOnchain(account, "Axion", metadataURI);
          mode = res.mode;
          txHash = res.txHash;
        }
      }

      const newAgent: AgentIdentity = {
        agentId: mode === "onchain" ? `mantle-${Date.now()}` : `axion-local-${Date.now()}`,
        agentName: "Axion",
        owner,
        metadataURI,
        strategyVersion: 1,
        memoryRoot: ZERO_ROOT,
        trustScore: START_TRUST_SCORE,
        totalEpochs: 0,
        correctPredictions: 0,
        safeRejections: 0,
        failedPredictions: 0,
        selfCorrections: 0,
        createdAt: Date.now(),
        mode,
        txHash,
      };
      persist(withAgent(state!, newAgent));
      setNotice(
        mode === "onchain"
          ? "Agent registered on Mantle."
          : "Agent initialised in local demo mode."
      );
    } catch (e) {
      setError(humanError(e));
    } finally {
      setBusy(null);
    }
  }

  function handleGenerate() {
    setError(null);
    setNotice(null);
    if (!agent) return;
    const g = goal.trim() || DEMO_GOAL;
    const t = generateDecisionTree(g, state!.policy, state!.strategy, agent.strategyVersion);
    setTree(t);
    setCommitment(null);
    setExecution(null);
    setJudged(null);
    setPersisted(false);
    persist(addTree(state!, t));
    scrollToResult();
  }

  async function handleCommit() {
    if (!agent || !tree) return;
    setError(null);
    setBusy("commit");
    try {
      let mode: "local" | "onchain" = "local";
      let txHash: string | undefined;
      if (canTransactOnchain()) {
        const account = await connectWallet();
        if (account) {
          try {
            const res = await commitDecisionTreeOnchain(
              account,
              BigInt(0),
              tree.goalHash as `0x${string}`,
              tree.treeHash as `0x${string}`,
              tree.selectedBranchHash as `0x${string}`,
              tree.policyHash as `0x${string}`,
              BigInt(tree.strategyVersion)
            );
            mode = res.mode;
            txHash = res.txHash;
          } catch {
            mode = "local"; // never break the demo on a chain hiccup
          }
        }
      }
      const c: Commitment = {
        commitmentId: `commit-${Date.now()}`,
        agentId: agent.agentId,
        goalHash: tree.goalHash,
        treeHash: tree.treeHash,
        selectedBranchHash: tree.selectedBranchHash,
        policyHash: tree.policyHash,
        strategyVersion: tree.strategyVersion,
        timestamp: Date.now(),
        mode,
        txHash,
      };
      setCommitment(c);
      persist(addCommitment(state!, c));
      setNotice(
        mode === "onchain" ? "Decision tree committed on Mantle." : "Decision tree committed (local hash)."
      );
      scrollToResult();
    } catch (e) {
      setError(humanError(e));
    } finally {
      setBusy(null);
    }
  }

  function handleExecute() {
    if (!tree || !selectedBranch) return;
    setError(null);
    setBusy("execute");
    try {
      const result = executeBranch(adapter, selectedBranch, state!.policy);
      setExecution(result);
      scrollToResult();
    } catch (e) {
      setError(humanError(e));
    } finally {
      setBusy(null);
    }
  }

  async function handleVerify() {
    if (!agent || !tree || !commitment || !execution) return;
    setError(null);
    setBusy("verify");
    try {
      // Try to enrich the post-mortem via the API (LLM if a key is set,
      // deterministic fallback otherwise). Never break if it fails.
      let llmPostMortem: PostMortem | null = null;
      try {
        const res = await fetch("/api/postmortem", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            goal: tree.goal,
            branch: selectedBranch,
            prediction: {
              expectedYieldPct: selectedBranch?.routeId ? execution.actualYieldPct : 0,
            },
            execution,
          }),
        });
        if (res.ok) {
          const data = (await res.json()) as { postMortem?: PostMortem | null };
          if (data.postMortem) llmPostMortem = data.postMortem;
        }
      } catch {
        /* deterministic fallback is used inside judgeAndForge */
      }

      const result = judgeAndForge({
        agent,
        strategy: state!.strategy,
        tree,
        commitment,
        execution,
        llmPostMortem,
      });
      setJudged(result);
      scrollToResult();
    } catch (e) {
      setError(humanError(e));
    } finally {
      setBusy(null);
    }
  }

  async function handleForge() {
    if (!agent || !commitment || !judged) return;
    setError(null);
    setBusy("forge");
    try {
      let epoch = judged.epoch;
      // Persist epoch on-chain if configured.
      if (canTransactOnchain() && commitment.mode === "onchain") {
        try {
          const account = await connectWallet();
          if (account) {
            const res = await writeEpochOnchain(
              account,
              BigInt(0),
              BigInt(0),
              epoch.actionHash as `0x${string}`,
              epoch.outcomeHash as `0x${string}`,
              epoch.postMortemHash as `0x${string}`,
              epoch.verdict,
              BigInt(epoch.score),
              epoch.memoryRootAfter as `0x${string}`,
              BigInt(epoch.strategyVersionAfter)
            );
            if (res.mode === "onchain") {
              epoch = { ...epoch, mode: "onchain", txHash: res.txHash };
            }
          }
        } catch {
          /* keep local epoch */
        }
      }

      let next = addEpoch(state!, epoch);
      next = withAgent(next, judged.newAgent);
      next = withStrategy(next, judged.newStrategy);
      persist(next);
      setPersisted(true);
      setNotice("Strategy forged and agent evolved. Epoch written to the timeline.");
      scrollToResult();
    } catch (e) {
      setError(humanError(e));
    } finally {
      setBusy(null);
    }
  }

  function handleReset() {
    const fresh = resetState();
    setState(fresh);
    setTree(null);
    setCommitment(null);
    setExecution(null);
    setJudged(null);
    setPersisted(false);
    setNotice("Demo state cleared.");
  }

  function startNewRun() {
    setTree(null);
    setCommitment(null);
    setExecution(null);
    setJudged(null);
    setPersisted(false);
    setNotice(null);
    setError(null);
  }

  function scrollToResult() {
    requestAnimationFrame(() => {
      resultRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    });
  }

  const onchainBadge = isOnchainConfigured() ? (
    hasInjectedWallet() ? (
      <Badge tone="emerald">On-chain ready</Badge>
    ) : (
      <Badge tone="amber">On-chain configured · connect wallet</Badge>
    )
  ) : (
    <Badge tone="violet">Local demo mode</Badge>
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="label mb-1">Agent console</div>
          <h1 className="font-display text-3xl font-extrabold">
            Run the <span className="gradient-text">lifecycle</span>
          </h1>
          <p className="mt-1 text-sm text-[var(--muted)]">
            Most AI wallets act first and explain later. Axion commits before it acts.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {onchainBadge}
          <button onClick={handleReset} className="btn btn-ghost text-xs">
            Reset demo
          </button>
        </div>
      </div>

      <LifecycleStepper current={current} />

      {error && (
        <div className="rounded-xl border border-[rgba(251,113,133,0.4)] bg-[rgba(251,113,133,0.08)] px-4 py-3 text-sm text-[var(--rose)]">
          {error}
        </div>
      )}
      {notice && !error && (
        <div className="rounded-xl border border-[rgba(45,212,191,0.35)] bg-[rgba(45,212,191,0.06)] px-4 py-3 text-sm text-[var(--teal-glow)]">
          {notice}
        </div>
      )}

      {!agent ? (
        <div className="panel p-8 text-center">
          <h2 className="font-display text-xl font-bold">Initialise the Axion agent</h2>
          <p className="mx-auto mt-2 max-w-md text-sm text-[var(--muted)]">
            Create the ERC-8004-style identity that will own every commitment and epoch. In local
            mode this lives in your browser. With contracts configured and a wallet connected, it
            registers on Mantle.
          </p>
          <button
            onClick={initAgent}
            disabled={busy === "init"}
            className="btn btn-primary mx-auto mt-5 px-6 py-3"
          >
            {busy === "init" ? "Initialising…" : "Initialise agent"}
          </button>
        </div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[1.6fr_1fr]">
          {/* Left: lifecycle controls + results */}
          <div className="space-y-6">
            <div className="panel p-5">
              <SectionTitle eyebrow="Step 1 · Predict" title="Goal" />
              <textarea
                value={goal}
                onChange={(e) => setGoal(e.target.value)}
                rows={3}
                className="mono w-full resize-none rounded-xl border border-[var(--border)] bg-black/30 p-3 text-sm text-[var(--text)] outline-none focus:border-[var(--border-strong)]"
                placeholder="Describe the goal for Axion…"
              />
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <button onClick={handleGenerate} className="btn btn-primary">
                  Generate decision tree
                </button>
                {tree && (
                  <button onClick={startNewRun} className="btn btn-ghost text-xs">
                    New run
                  </button>
                )}
                <span className="text-xs text-[var(--muted)]">
                  Every goal becomes a decision tree.
                </span>
              </div>
            </div>

            <div ref={resultRef} className="space-y-6">
              {tree && (
                <section>
                  <SectionTitle
                    eyebrow="Step 2 · Commit"
                    title="Decision tree"
                  >
                    {!commitment ? (
                      <button
                        onClick={handleCommit}
                        disabled={busy === "commit"}
                        className="btn btn-primary"
                      >
                        {busy === "commit" ? "Committing…" : "Commit decision tree"}
                      </button>
                    ) : (
                      <Badge tone={commitment.mode === "onchain" ? "emerald" : "violet"}>
                        Committed · {commitment.mode}
                      </Badge>
                    )}
                  </SectionTitle>
                  <DecisionTreeView tree={tree} />
                  {commitment?.txHash && (
                    <a
                      href={txExplorerLink(commitment.txHash)}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-2 inline-block text-xs text-[var(--violet)] hover:underline"
                    >
                      View commitment transaction ↗
                    </a>
                  )}
                </section>
              )}

              {commitment && selectedBranch && (
                <section>
                  <SectionTitle eyebrow="Step 3 · Execute" title="Execution & skills">
                    {!execution ? (
                      <button
                        onClick={handleExecute}
                        disabled={busy === "execute"}
                        className="btn btn-primary"
                      >
                        {busy === "execute" ? "Executing…" : "Execute selected branch"}
                      </button>
                    ) : (
                      <Badge tone={execution.succeeded ? "emerald" : "rose"}>
                        {execution.succeeded ? "Executed" : "Blocked"}
                      </Badge>
                    )}
                  </SectionTitle>
                  {execution ? (
                    <ExecutionView
                      branch={selectedBranch}
                      execution={execution}
                      adapterName={adapter.name}
                    />
                  ) : (
                    <div className="panel p-5 text-sm text-[var(--muted)]">
                      Selected branch <strong className="text-[var(--text)]">{selectedBranch.id} · {selectedBranch.name}</strong> is
                      ready. Execution runs it through the skill adapter with hard safety gates.
                    </div>
                  )}
                </section>
              )}

              {execution && (
                <section>
                  <SectionTitle eyebrow="Step 4 · Judge" title="Verify outcome vs prediction">
                    {!judged ? (
                      <button
                        onClick={handleVerify}
                        disabled={busy === "verify"}
                        className="btn btn-primary"
                      >
                        {busy === "verify" ? "Verifying…" : "Verify outcome"}
                      </button>
                    ) : (
                      <Badge tone="teal">Judged</Badge>
                    )}
                  </SectionTitle>
                  {judged ? (
                    <EpochView epoch={judged.epoch} />
                  ) : (
                    <div className="panel p-5 text-sm text-[var(--muted)]">
                      Axion will compare the realised outcome against the prediction it committed
                      before acting, then write a judged post-mortem.
                    </div>
                  )}
                </section>
              )}

              {judged && (
                <section>
                  <SectionTitle eyebrow="Step 5 · Forge → Evolve" title="Forge next strategy">
                    {!persisted ? (
                      <button
                        onClick={handleForge}
                        disabled={busy === "forge"}
                        className="btn btn-primary"
                      >
                        {busy === "forge" ? "Forging…" : "Forge upgrade & evolve"}
                      </button>
                    ) : (
                      <Badge tone="emerald">Evolved</Badge>
                    )}
                  </SectionTitle>
                  {persisted ? (
                    <div className="panel p-6">
                      <h3 className="font-display text-lg font-bold">Agent evolved</h3>
                      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
                        <Evolve label="Trust score" before={agent.trustScore} after={judged.newAgent.trustScore} />
                        <Evolve
                          label="Strategy version"
                          before={`v${judged.epoch.strategyVersionBefore}`}
                          after={`v${judged.epoch.strategyVersionAfter}`}
                        />
                        <Evolve label="Total epochs" before={agent.totalEpochs} after={judged.newAgent.totalEpochs} />
                        <Evolve
                          label="Verdict"
                          before=""
                          after={judged.epoch.verdict}
                          single
                        />
                      </div>
                      <div className="mt-5 flex flex-wrap gap-2">
                        <Link href="/identity" className="btn btn-primary">
                          View identity & timeline →
                        </Link>
                        <button onClick={startNewRun} className="btn btn-ghost">
                          Run another goal
                        </button>
                      </div>
                      <p className="mt-4 text-xs text-[var(--muted)]">
                        Every outcome forges the next strategy. The wallet&apos;s memory is not
                        cosmetic — it changed the trust score, permissions and strategy version above.
                      </p>
                    </div>
                  ) : (
                    <div className="panel p-5 text-sm text-[var(--muted)]">
                      Forging applies the verified outcome to the strategy weights, bumps the
                      strategy version, updates the trust score and chains a new memory root.
                    </div>
                  )}
                </section>
              )}
            </div>
          </div>

          {/* Right: policy + identity snapshot */}
          <div className="space-y-6">
            <PolicyCard
              policy={state.policy}
              trustScore={agent.trustScore}
              onTogglePause={() =>
                persist(withPolicy(state!, { ...state!.policy, isPaused: !state!.policy.isPaused }))
              }
              onToggleUnsafe={() =>
                persist(
                  withPolicy(state!, {
                    ...state!.policy,
                    allowUnsafeApprovals: !state!.policy.allowUnsafeApprovals,
                  })
                )
              }
            />

            <div className="panel p-5">
              <SectionTitle title="Agent snapshot" />
              <div className="grid grid-cols-2 gap-3 text-sm">
                <Snap label="Name" value={agent.agentName} />
                <Snap label="Trust" value={String(agent.trustScore)} />
                <Snap label="Strategy" value={`v${agent.strategyVersion}`} />
                <Snap label="Epochs" value={String(agent.totalEpochs)} />
                <Snap label="Correct" value={String(agent.correctPredictions)} />
                <Snap label="Safe rejections" value={String(agent.safeRejections)} />
              </div>
              <Link href="/identity" className="btn btn-ghost mt-4 w-full">
                Open full identity →
              </Link>
            </div>

            <div className="panel p-5">
              <div className="label mb-2">Honesty note</div>
              <p className="text-xs leading-relaxed text-[var(--muted)]">
                DeFi routes in this demo are simulated and clearly labelled. The lifecycle —
                pre-commitment, execution, verification, post-mortem and evolution — is real and
                deterministic, and persists across refresh via local storage.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Evolve({
  label,
  before,
  after,
  single,
}: {
  label: string;
  before: string | number;
  after: string | number;
  single?: boolean;
}) {
  return (
    <div className="rounded-xl border border-[var(--border-strong)] bg-black/20 p-4">
      <div className="label">{label}</div>
      {single ? (
        <div className="mono mt-1 text-lg font-bold text-[var(--teal-glow)]">{after}</div>
      ) : (
        <div className="mono mt-1 flex items-center gap-1.5 text-lg font-bold">
          <span className="text-[var(--muted)]">{before}</span>
          <span className="text-[var(--muted)]">→</span>
          <span className="text-[var(--teal-glow)]">{after}</span>
        </div>
      )}
    </div>
  );
}

function Snap({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-[var(--border)] bg-black/20 px-3 py-2">
      <div className="label">{label}</div>
      <div className="mt-0.5 font-semibold text-[var(--text)]">{value}</div>
    </div>
  );
}

function humanError(e: unknown): string {
  const msg = e instanceof Error ? e.message : String(e);
  if (/user rejected|denied/i.test(msg)) return "Wallet request was rejected.";
  return `Something went wrong: ${msg}. The demo continues in local mode.`;
}
