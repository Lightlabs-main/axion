// Central type definitions for the Axion agentic wallet.

export type RiskLevel =
  | "lowest"
  | "low"
  | "low-medium"
  | "medium"
  | "medium-high"
  | "high";

export type ApprovalRisk = "none" | "safe" | "unsafe";

export interface Route {
  id: string;
  name: string;
  expectedYieldPct: number;
  liquidity: "full" | "high" | "medium" | "low";
  slippageBps: number; // basis points
  approvalRisk: ApprovalRisk;
  protocolTrust: "n/a" | "low" | "medium" | "high";
  risk: RiskLevel;
  isDemoRoute: true; // we are always honest: these are simulated routes
}

export interface Policy {
  maxSpend: number; // human units (e.g. 100 USDC)
  asset: string; // e.g. "USDC"
  maxSlippageBps: number; // 50 = 0.50%
  allowUnsafeApprovals: boolean;
  allowedAssets: string[];
  allowedProtocols: string[];
  isPaused: boolean;
}

export interface StrategyState {
  riskWeight: number;
  yieldWeight: number;
  liquidityWeight: number;
  approvalSafetyWeight: number;
  sourceConfidenceWeight: number;
  slippageTolerance: number; // bps
}

export type BranchStatus =
  | "selected"
  | "rejected"
  | "fallback"
  | "unsafe"
  | "candidate";

export interface Branch {
  id: "A" | "B" | "C" | "D";
  name: string;
  action: string;
  expectedOutcome: string;
  riskLevel: RiskLevel;
  confidence: number; // 0-100
  reason: string;
  fallbackTrigger: string;
  status: BranchStatus;
  score: number; // computed utility score
  routeId?: string;
  branchHash: string;
}

export interface DecisionTree {
  goal: string;
  branches: Branch[];
  selectedBranchId: Branch["id"];
  strategyVersion: number;
  policySnapshot: Policy;
  // hashes (committed before action)
  goalHash: string;
  treeHash: string;
  selectedBranchHash: string;
  policyHash: string;
  createdAt: number;
}

export interface Commitment {
  commitmentId: string; // local id or on-chain id
  agentId: string;
  goalHash: string;
  treeHash: string;
  selectedBranchHash: string;
  policyHash: string;
  strategyVersion: number;
  timestamp: number;
  txHash?: string; // present if committed on-chain
  mode: "local" | "onchain";
}

export interface ExecutionResult {
  branchId: Branch["id"];
  routeId?: string;
  skillTrace: SkillTraceEntry[];
  actualYieldPct: number;
  actualSlippageBps: number;
  succeeded: boolean;
  blockedReason?: string;
  actionHash: string;
  outcomeHash: string;
  txHash?: string;
  mode: "local" | "onchain";
}

export interface SkillTraceEntry {
  skill: string;
  input: string;
  output: string;
  passed: boolean;
}

export type Verdict =
  | "Correct"
  | "PartiallyCorrect"
  | "Wrong"
  | "RejectedSafely"
  | "UnsafeBlocked";

export interface PostMortem {
  whatWasRight: string[];
  whatWasWrong: string[];
  narrative: string;
  source: "deterministic" | "llm";
}

export interface Epoch {
  epochId: string;
  agentId: string;
  commitmentId: string;
  goal: string;
  selectedBranchId: Branch["id"];
  prediction: {
    expectedYieldPct: number;
    expectedSlippageBps: number;
  };
  outcome: {
    actualYieldPct: number;
    actualSlippageBps: number;
    succeeded: boolean;
  };
  verdict: Verdict;
  score: number; // trust score AFTER this epoch
  scoreDelta: number;
  postMortem: PostMortem;
  strategyBefore: StrategyState;
  strategyAfter: StrategyState;
  strategyVersionBefore: number;
  strategyVersionAfter: number;
  memoryRootBefore: string;
  memoryRootAfter: string;
  actionHash: string;
  outcomeHash: string;
  postMortemHash: string;
  timestamp: number;
  txHash?: string;
  mode: "local" | "onchain";
}

export interface AgentIdentity {
  agentId: string;
  agentName: string;
  owner: string;
  metadataURI: string;
  strategyVersion: number;
  memoryRoot: string;
  trustScore: number;
  totalEpochs: number;
  correctPredictions: number;
  safeRejections: number;
  failedPredictions: number;
  selfCorrections: number;
  createdAt: number;
  mode: "local" | "onchain";
  txHash?: string;
}

export type PermissionLevel =
  | "Read-only / simulation only"
  | "Suggest actions only"
  | "Execute low-value actions"
  | "Higher autonomous limit";

export interface AxionDemoState {
  agent: AgentIdentity | null;
  policy: Policy;
  strategy: StrategyState;
  trees: DecisionTree[];
  commitments: Commitment[];
  epochs: Epoch[];
}
