"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Address } from "viem";
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
  commitDecisionTreeOnchain,
  connectWallet,
  evolveIdentityOnchain,
  faucetUsdc,
  getChainId,
  getUsdcBalance,
  hasInjectedWallet,
  registerAgentOnchain,
  writeEpochOnchain,
} from "@/lib/contractClient";
import {
  ACTIVE_CHAIN,
  CHAIN_ID,
  addressExplorerLink,
  isOnchainConfigured,
  txExplorerLink,
} from "@/lib/config";
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

  // Wallet / chain state.
  const [account, setAccount] = useState<Address | null>(null);
  const [chainId, setChainId] = useState<number | null>(null);
  const [usdc, setUsdc] = useState<number>(0);

  // Ephemeral lifecycle working state (current run).
  const [tree, setTree] = useState<DecisionTree | null>(null);
  const [commitment, setCommitment] = useState<Commitment | null>(null);
  const [execution, setExecution] = useState<ExecutionResult | null>(null);
  const [judged, setJudged] = useState<JudgeForgeResult | null>(null);
  const [persisted, setPersisted] = useState(false);

  const resultRef = useRef<HTMLDivElement | null>(null);

  const configured = isOnchainConfigured();
  const hasWallet = hasInjectedWallet();

  useEffect(() => {
    setState(loadState());
    setMounted(true);
  }, []);

  const refreshWallet = useCallback(async (acc: Address) => {
    try {
      const [cid, bal] = await Promise.all([getChainId(), getUsdcBalance(acc)]);
      setChainId(cid);
      setUsdc(bal);
    } catch {
      /* non-fatal */
    }
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
  const wrongChain = account !== null && chainId !== null && chainId !== CHAIN_ID;

  async function handleConnect() {
    setError(null);
    setBusy("connect");
    try {
      const acc = await connectWallet();
      if (!acc) throw new Error("No account returned from wallet.");
      setAccount(acc);
      await refreshWallet(acc);
      setNotice("Wallet connected.");
    } catch (e) {
      setError(humanError(e));
    } finally {
      setBusy(null);
    }
  }

  async function handleFaucet() {
    if (!account) return;
    setError(null);
    setBusy("faucet");
    try {
      await faucetUsdc(account, 1000);
      await refreshWallet(account);
      setNotice("Minted 1,000 test aUSDC to your wallet.");
    } catch (e) {
      setError(humanError(e));
    } finally {
      setBusy(null);
    }
  }

  async function initAgent() {
    if (!account) return;
    setError(null);
    setBusy("init");
    try {
      const metadataURI = "ipfs://axion-agent/erc8004.json";
      const res = await registerAgentOnchain(account, "Axion", metadataURI);

      const newAgent: AgentIdentity = {
        agentId: res.agentId.toString(),
        agentName: "Axion",
        owner: account,
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
        mode: "onchain",
        txHash: res.txHash,
      };
      persist(withAgent(state!, newAgent));
      setNotice(`Agent #${res.agentId} registered on ${ACTIVE_CHAIN.name}.`);
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
    if (!agent || !tree || !account) return;
    setError(null);
    setBusy("commit");
    try {
      const res = await commitDecisionTreeOnchain(
        account,
        BigInt(agent.agentId),
        tree.goalHash as `0x${string}`,
        tree.treeHash as `0x${string}`,
        tree.selectedBranchHash as `0x${string}`,
        tree.policyHash as `0x${string}`,
        BigInt(tree.strategyVersion)
      );
      const c: Commitment = {
        commitmentId: res.commitmentId.toString(),
        agentId: agent.agentId,
        goalHash: tree.goalHash,
        treeHash: tree.treeHash,
        selectedBranchHash: tree.selectedBranchHash,
        policyHash: tree.policyHash,
        strategyVersion: tree.strategyVersion,
        timestamp: Date.now(),
        mode: "onchain",
        txHash: res.txHash,
      };
      setCommitment(c);
      persist(addCommitment(state!, c));
      setNotice(`Decision tree committed on-chain · commitment #${res.commitmentId}.`);
      scrollToResult();
    } catch (e) {
      setError(humanError(e));
    } finally {
      setBusy(null);
    }
  }

  async function handleExecute() {
    if (!tree || !selectedBranch || !account) return;
    setError(null);
    setBusy("execute");
    try {
      const result = await executeBranch(adapter, selectedBranch, state!.policy, account);
      setExecution(result);
      await refreshWallet(account);
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
      let llmPostMortem: PostMortem | null = null;
      try {
        const res = await fetch("/api/postmortem", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ goal: tree.goal, branch: selectedBranch, execution }),
        });
        if (res.ok) {
          const data = (await res.json()) as { postMortem?: PostMortem | null };
          if (data.postMortem) llmPostMortem = data.postMortem;
        }
      } catch {
        /* deterministic fallback used inside judgeAndForge */
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
    if (!agent || !commitment || !judged || !account) return;
    setError(null);
    setBusy("forge");
    try {
      const epochResult = await writeEpochOnchain(
        account,
        BigInt(agent.agentId),
        BigInt(commitment.commitmentId),
        judged.epoch.actionHash as `0x${string}`,
        judged.epoch.outcomeHash as `0x${string}`,
        judged.epoch.postMortemHash as `0x${string}`,
        judged.epoch.verdict,
        BigInt(judged.epoch.score),
        judged.epoch.memoryRootAfter as `0x${string}`,
        BigInt(judged.epoch.strategyVersionAfter)
      );

      // Evolve the on-chain identity (trust, strategy version, memory root, epoch count).
      await evolveIdentityOnchain(
        account,
        BigInt(agent.agentId),
        BigInt(judged.newAgent.trustScore),
        BigInt(judged.epoch.strategyVersionAfter),
        judged.epoch.memoryRootAfter as `0x${string}`
      );

      const epoch = {
        ...judged.epoch,
        epochId: epochResult.epochId.toString(),
        mode: "onchain" as const,
        txHash: epochResult.txHash,
      };

      let next = addEpoch(state!, epoch);
      next = withAgent(next, judged.newAgent);
      next = withStrategy(next, judged.newStrategy);
      persist(next);
      setPersisted(true);
      setNotice(`Epoch #${epochResult.epochId} written on-chain. Agent evolved.`);
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
    setNotice("Local cache cleared. On-chain history is permanent.");
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

  // ---- Gating screens (honest: no simulated fallback) ----
  if (!configured) {
    return <SetupGate />;
  }
  if (!hasWallet) {
    return (
      <Gate
        title="Connect a browser wallet"
        body="Axion runs the full lifecycle as real transactions on Mantle. Install MetaMask (or any EIP-1193 wallet) and reload this page."
      />
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="label mb-1">Agent console · {ACTIVE_CHAIN.name}</div>
          <h1 className="font-display text-3xl font-extrabold">
            Run the <span className="gradient-text">lifecycle</span>
          </h1>
          <p className="mt-1 text-sm text-[var(--muted)]">
            Most AI wallets act first and explain later. Axion commits before it acts — on-chain.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {account ? (
            <Badge tone={wrongChain ? "amber" : "emerald"}>
              {wrongChain ? "Wrong network" : `${account.slice(0, 6)}…${account.slice(-4)}`}
            </Badge>
          ) : (
            <Badge tone="violet">Wallet not connected</Badge>
          )}
          {account && <Badge tone="teal">{usdc.toFixed(2)} aUSDC</Badge>}
          <button onClick={handleReset} className="btn btn-ghost text-xs">
            Clear cache
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

      {!account ? (
        <div className="panel p-8 text-center">
          <h2 className="font-display text-xl font-bold">Connect your wallet</h2>
          <p className="mx-auto mt-2 max-w-md text-sm text-[var(--muted)]">
            Connect to {ACTIVE_CHAIN.name} to register the agent and run the lifecycle as real
            transactions. You can mint free test aUSDC once connected.
          </p>
          <button
            onClick={handleConnect}
            disabled={busy === "connect"}
            className="btn btn-primary mx-auto mt-5 px-6 py-3"
          >
            {busy === "connect" ? "Connecting…" : "Connect wallet"}
          </button>
        </div>
      ) : !agent ? (
        <div className="panel p-8 text-center">
          <h2 className="font-display text-xl font-bold">Register the Axion agent</h2>
          <p className="mx-auto mt-2 max-w-md text-sm text-[var(--muted)]">
            Create the ERC-8004-style identity on-chain. It will own every commitment and epoch you
            produce, with a trust score starting at {START_TRUST_SCORE}.
          </p>
          <div className="mt-5 flex items-center justify-center gap-2">
            <button onClick={initAgent} disabled={busy === "init"} className="btn btn-primary px-6 py-3">
              {busy === "init" ? "Registering on-chain…" : "Register agent"}
            </button>
            <button onClick={handleFaucet} disabled={busy === "faucet"} className="btn btn-ghost">
              {busy === "faucet" ? "Minting…" : "Get 1,000 test aUSDC"}
            </button>
          </div>
        </div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[1.6fr_1fr]">
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
                <span className="text-xs text-[var(--muted)]">Every goal becomes a decision tree.</span>
              </div>
            </div>

            <div ref={resultRef} className="space-y-6">
              {tree && (
                <section>
                  <SectionTitle eyebrow="Step 2 · Commit" title="Decision tree">
                    {!commitment ? (
                      <button onClick={handleCommit} disabled={busy === "commit"} className="btn btn-primary">
                        {busy === "commit" ? "Committing on-chain…" : "Commit decision tree"}
                      </button>
                    ) : (
                      <Badge tone="emerald">Committed · #{commitment.commitmentId}</Badge>
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
                      <button onClick={handleExecute} disabled={busy === "execute"} className="btn btn-primary">
                        {busy === "execute" ? "Executing on-chain…" : "Execute selected branch"}
                      </button>
                    ) : (
                      <Badge tone={execution.succeeded ? "emerald" : "rose"}>
                        {execution.succeeded ? "Executed" : "Blocked"}
                      </Badge>
                    )}
                  </SectionTitle>
                  {execution ? (
                    <ExecutionView branch={selectedBranch} execution={execution} adapterName={adapter.name} />
                  ) : (
                    <div className="panel p-5 text-sm text-[var(--muted)]">
                      Selected branch{" "}
                      <strong className="text-[var(--text)]">
                        {selectedBranch.id} · {selectedBranch.name}
                      </strong>{" "}
                      is ready. Execution reads the vault&apos;s on-chain terms, runs the safety
                      gates, and deposits real test aUSDC if it passes.
                    </div>
                  )}
                </section>
              )}

              {execution && (
                <section>
                  <SectionTitle eyebrow="Step 4 · Judge" title="Verify outcome vs prediction">
                    {!judged ? (
                      <button onClick={handleVerify} disabled={busy === "verify"} className="btn btn-primary">
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
                      Axion compares the realised on-chain outcome against the prediction it committed
                      before acting, then writes a judged post-mortem.
                    </div>
                  )}
                </section>
              )}

              {judged && (
                <section>
                  <SectionTitle eyebrow="Step 5 · Forge → Evolve" title="Forge next strategy">
                    {!persisted ? (
                      <button onClick={handleForge} disabled={busy === "forge"} className="btn btn-primary">
                        {busy === "forge" ? "Writing epoch on-chain…" : "Forge upgrade & evolve"}
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
                        <Evolve label="Verdict" before="" after={judged.epoch.verdict} single />
                      </div>
                      {judged.epoch.txHash && (
                        <a
                          href={txExplorerLink(judged.epoch.txHash)}
                          target="_blank"
                          rel="noreferrer"
                          className="mt-3 inline-block text-xs text-[var(--violet)] hover:underline"
                        >
                          View epoch transaction ↗
                        </a>
                      )}
                      <div className="mt-5 flex flex-wrap gap-2">
                        <Link href="/identity" className="btn btn-primary">
                          View identity & timeline →
                        </Link>
                        <button onClick={startNewRun} className="btn btn-ghost">
                          Run another goal
                        </button>
                      </div>
                      <p className="mt-4 text-xs text-[var(--muted)]">
                        Every outcome forges the next strategy. The trust score, strategy version and
                        memory root above were all updated on-chain.
                      </p>
                    </div>
                  ) : (
                    <div className="panel p-5 text-sm text-[var(--muted)]">
                      Forging writes the judged epoch to the EpochMemoryLog and updates the agent&apos;s
                      on-chain trust score, strategy version and memory root.
                    </div>
                  )}
                </section>
              )}
            </div>
          </div>

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
              <div className="flex items-center justify-between">
                <SectionTitle title="Wallet" />
                <button onClick={handleFaucet} disabled={busy === "faucet"} className="btn btn-ghost text-xs">
                  {busy === "faucet" ? "Minting…" : "+1,000 aUSDC"}
                </button>
              </div>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <Snap label="Network" value={ACTIVE_CHAIN.name} />
                <Snap label="aUSDC" value={usdc.toFixed(2)} />
                <Snap label="Agent ID" value={`#${agent.agentId}`} />
                <Snap label="Trust" value={String(agent.trustScore)} />
              </div>
              {agent.owner && (
                <a
                  href={addressExplorerLink(agent.owner)}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-3 inline-block text-xs text-[var(--violet)] hover:underline"
                >
                  View owner on explorer ↗
                </a>
              )}
              <Link href="/identity" className="btn btn-ghost mt-3 w-full">
                Open full identity →
              </Link>
            </div>

            <div className="panel p-5">
              <div className="label mb-2">Honesty note</div>
              <p className="text-xs leading-relaxed text-[var(--muted)]">
                aUSDC and the yield vaults are real contracts deployed by Axion for testing — they
                are not third-party DeFi protocols. The advertised route numbers are the agent&apos;s
                pre-execution estimates; the realised APY and entry fee are read from the vault
                on-chain, and deposits are real transactions you can verify on the explorer.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function SetupGate() {
  return (
    <Gate
      title="Contracts not configured yet"
      body="The real on-chain build needs deployed Mantle addresses. Deploy the contracts, then set them in web/.env.local and reload."
    >
      <pre className="mono mt-4 overflow-x-auto rounded-xl border border-[var(--border)] bg-black/40 p-4 text-left text-xs text-[var(--muted)]">
{`# 1. add a funded key to contracts/.env
PRIVATE_KEY=0x...

# 2. deploy to Mantle Sepolia
cd contracts && npm run deploy:mantle

# 3. the script writes web/.env.local for you
# 4. restart the web app`}
      </pre>
    </Gate>
  );
}

function Gate({ title, body, children }: { title: string; body: string; children?: React.ReactNode }) {
  return (
    <div className="space-y-6">
      <LifecycleStepper current={0} />
      <div className="panel p-8 text-center">
        <h2 className="font-display text-xl font-bold">{title}</h2>
        <p className="mx-auto mt-2 max-w-lg text-sm text-[var(--muted)]">{body}</p>
        {children}
      </div>
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
  if (/insufficient funds/i.test(msg)) return "Insufficient MNT for gas. Top up your wallet.";
  if (/insufficient balance|transfer amount exceeds/i.test(msg))
    return "Not enough aUSDC. Use the faucet to mint test tokens first.";
  return `Something went wrong: ${msg}`;
}
