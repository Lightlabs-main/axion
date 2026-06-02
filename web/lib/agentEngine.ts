import type {
  AgentIdentity,
  Branch,
  Commitment,
  DecisionTree,
  Epoch,
  ExecutionResult,
  PostMortem,
  StrategyState,
} from "@/types";
import {
  buildDeterministicPostMortem,
  epochScore,
  forgeStrategy,
  judgeOutcome,
  predictionForBranch,
} from "./strategyForge";
import { applyTrustDelta } from "./trustScore";
import { calculateMemoryRoot, hashPayload, hashPostMortem } from "./hashing";

export interface JudgeForgeInput {
  agent: AgentIdentity;
  strategy: StrategyState;
  tree: DecisionTree;
  commitment: Commitment;
  execution: ExecutionResult;
  /** Optional richer post-mortem from the LLM route; falls back to deterministic. */
  llmPostMortem?: PostMortem | null;
}

export interface JudgeForgeResult {
  epoch: Epoch;
  newStrategy: StrategyState;
  newAgent: AgentIdentity;
}

/**
 * Take a committed decision tree + its real execution result and produce the
 * full judged epoch: verdict, score, post-mortem, forged strategy, new memory
 * root, updated trust score and evolving identity stats.
 */
export function judgeAndForge(input: JudgeForgeInput): JudgeForgeResult {
  const { agent, strategy, tree, commitment, execution, llmPostMortem } = input;

  const branch: Branch =
    tree.branches.find((b) => b.id === execution.branchId) ??
    tree.branches.find((b) => b.id === tree.selectedBranchId)!;

  const prediction = predictionForBranch(branch);
  const { verdict, critical } = judgeOutcome(branch, prediction, execution);
  const score = epochScore(branch, prediction, execution, verdict);

  const postMortem: PostMortem =
    llmPostMortem ?? buildDeterministicPostMortem(branch, prediction, execution, verdict);
  const postMortemHash = hashPostMortem(postMortem);

  // Trust score evolution.
  const { next: newTrust, delta } = applyTrustDelta(agent.trustScore, verdict, critical);

  // Strategy forge -> new version.
  const newStrategy = forgeStrategy(strategy, branch, prediction, execution, verdict);
  const strategyVersionAfter = agent.strategyVersion + 1;

  // Memory root chaining.
  const epochHash = hashPayload({
    commitmentId: commitment.commitmentId,
    actionHash: execution.actionHash,
    outcomeHash: execution.outcomeHash,
    postMortemHash,
    verdict,
    score,
  });
  const memoryRootAfter = calculateMemoryRoot(agent.memoryRoot, epochHash);

  // Identity stat counters.
  const correctPredictions =
    agent.correctPredictions + (verdict === "Correct" ? 1 : 0);
  const safeRejections =
    agent.safeRejections +
    (verdict === "RejectedSafely" || verdict === "UnsafeBlocked" ? 1 : 0);
  const failedPredictions =
    agent.failedPredictions + (verdict === "Wrong" ? 1 : 0);
  const selfCorrections =
    agent.selfCorrections + (verdict === "Wrong" || verdict === "PartiallyCorrect" ? 1 : 0);

  const epochId = `epoch-${agent.totalEpochs + 1}-${Date.now()}`;

  const epoch: Epoch = {
    epochId,
    agentId: agent.agentId,
    commitmentId: commitment.commitmentId,
    goal: tree.goal,
    selectedBranchId: branch.id,
    prediction: {
      expectedYieldPct: prediction.expectedYieldPct,
      expectedSlippageBps: prediction.expectedSlippageBps,
    },
    outcome: {
      actualYieldPct: execution.actualYieldPct,
      actualSlippageBps: execution.actualSlippageBps,
      succeeded: execution.succeeded,
    },
    verdict,
    score: newTrust,
    scoreDelta: delta,
    postMortem,
    strategyBefore: strategy,
    strategyAfter: newStrategy,
    strategyVersionBefore: agent.strategyVersion,
    strategyVersionAfter,
    memoryRootBefore: agent.memoryRoot,
    memoryRootAfter,
    actionHash: execution.actionHash,
    outcomeHash: execution.outcomeHash,
    postMortemHash,
    timestamp: Date.now(),
    mode: commitment.mode,
  };

  const newAgent: AgentIdentity = {
    ...agent,
    strategyVersion: strategyVersionAfter,
    memoryRoot: memoryRootAfter,
    trustScore: newTrust,
    totalEpochs: agent.totalEpochs + 1,
    correctPredictions,
    safeRejections,
    failedPredictions,
    selfCorrections,
  };

  return { epoch, newStrategy, newAgent };
}
