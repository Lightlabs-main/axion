// Minimal ABIs matching the Axion Solidity contracts. Only the functions the
// frontend calls are included.

export const AGENT_REGISTRY_ABI = [
  {
    type: "function",
    name: "registerAgent",
    stateMutability: "nonpayable",
    inputs: [
      { name: "name", type: "string" },
      { name: "metadataURI", type: "string" },
    ],
    outputs: [{ name: "agentId", type: "uint256" }],
  },
  {
    type: "function",
    name: "updateMemoryRoot",
    stateMutability: "nonpayable",
    inputs: [
      { name: "agentId", type: "uint256" },
      { name: "newMemoryRoot", type: "bytes32" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "updateStrategyVersion",
    stateMutability: "nonpayable",
    inputs: [
      { name: "agentId", type: "uint256" },
      { name: "newVersion", type: "uint256" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "updateTrustScore",
    stateMutability: "nonpayable",
    inputs: [
      { name: "agentId", type: "uint256" },
      { name: "newScore", type: "uint256" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "incrementEpochCount",
    stateMutability: "nonpayable",
    inputs: [{ name: "agentId", type: "uint256" }],
    outputs: [],
  },
  {
    type: "event",
    name: "AgentRegistered",
    inputs: [
      { name: "agentId", type: "uint256", indexed: true },
      { name: "owner", type: "address", indexed: true },
      { name: "agentName", type: "string", indexed: false },
      { name: "metadataURI", type: "string", indexed: false },
      { name: "createdAt", type: "uint256", indexed: false },
    ],
  },
] as const;

export const DECISION_LOG_ABI = [
  {
    type: "function",
    name: "commitDecisionTree",
    stateMutability: "nonpayable",
    inputs: [
      { name: "agentId", type: "uint256" },
      { name: "goalHash", type: "bytes32" },
      { name: "treeHash", type: "bytes32" },
      { name: "selectedBranchHash", type: "bytes32" },
      { name: "policyHash", type: "bytes32" },
      { name: "strategyVersion", type: "uint256" },
    ],
    outputs: [{ name: "commitmentId", type: "uint256" }],
  },
  {
    type: "event",
    name: "DecisionTreeCommitted",
    inputs: [
      { name: "commitmentId", type: "uint256", indexed: true },
      { name: "agentId", type: "uint256", indexed: true },
      { name: "goalHash", type: "bytes32", indexed: false },
      { name: "treeHash", type: "bytes32", indexed: false },
      { name: "selectedBranchHash", type: "bytes32", indexed: false },
      { name: "policyHash", type: "bytes32", indexed: false },
      { name: "strategyVersion", type: "uint256", indexed: false },
      { name: "timestamp", type: "uint256", indexed: false },
    ],
  },
] as const;

export const EPOCH_LOG_ABI = [
  {
    type: "function",
    name: "writeEpoch",
    stateMutability: "nonpayable",
    inputs: [
      { name: "agentId", type: "uint256" },
      { name: "commitmentId", type: "uint256" },
      { name: "actionHash", type: "bytes32" },
      { name: "outcomeHash", type: "bytes32" },
      { name: "postMortemHash", type: "bytes32" },
      { name: "verdict", type: "uint8" },
      { name: "score", type: "uint256" },
      { name: "newMemoryRoot", type: "bytes32" },
      { name: "newStrategyVersion", type: "uint256" },
    ],
    outputs: [{ name: "epochId", type: "uint256" }],
  },
  {
    type: "event",
    name: "EpochWritten",
    inputs: [
      { name: "epochId", type: "uint256", indexed: true },
      { name: "agentId", type: "uint256", indexed: true },
      { name: "commitmentId", type: "uint256", indexed: true },
      { name: "verdict", type: "uint8", indexed: false },
      { name: "score", type: "uint256", indexed: false },
      { name: "newMemoryRoot", type: "bytes32", indexed: false },
      { name: "newStrategyVersion", type: "uint256", indexed: false },
      { name: "timestamp", type: "uint256", indexed: false },
    ],
  },
] as const;

// Maps the string verdicts to the on-chain enum index.
export const VERDICT_ENUM: Record<string, number> = {
  Correct: 0,
  PartiallyCorrect: 1,
  Wrong: 2,
  RejectedSafely: 3,
  UnsafeBlocked: 4,
};
