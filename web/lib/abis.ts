// ABIs matching the deployed Axion Solidity contracts. Includes the functions
// AND events the frontend uses — events are parsed from receipts to capture the
// real on-chain ids (agentId / commitmentId / epochId).

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
    type: "function",
    name: "getAgent",
    stateMutability: "view",
    inputs: [{ name: "agentId", type: "uint256" }],
    outputs: [
      {
        type: "tuple",
        components: [
          { name: "agentId", type: "uint256" },
          { name: "owner", type: "address" },
          { name: "agentName", type: "string" },
          { name: "metadataURI", type: "string" },
          { name: "strategyVersion", type: "uint256" },
          { name: "memoryRoot", type: "bytes32" },
          { name: "trustScore", type: "uint256" },
          { name: "totalEpochs", type: "uint256" },
          { name: "createdAt", type: "uint256" },
          { name: "exists", type: "bool" },
        ],
      },
    ],
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

export const ERC20_ABI = [
  {
    type: "function",
    name: "balanceOf",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "allowance",
    stateMutability: "view",
    inputs: [
      { name: "owner", type: "address" },
      { name: "spender", type: "address" },
    ],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "approve",
    stateMutability: "nonpayable",
    inputs: [
      { name: "spender", type: "address" },
      { name: "value", type: "uint256" },
    ],
    outputs: [{ name: "", type: "bool" }],
  },
  {
    type: "function",
    name: "faucet",
    stateMutability: "nonpayable",
    inputs: [{ name: "value", type: "uint256" }],
    outputs: [],
  },
] as const;

export const VAULT_ABI = [
  {
    type: "function",
    name: "deposit",
    stateMutability: "nonpayable",
    inputs: [{ name: "assets", type: "uint256" }],
    outputs: [{ name: "credited", type: "uint256" }],
  },
  {
    type: "function",
    name: "withdraw",
    stateMutability: "nonpayable",
    inputs: [],
    outputs: [{ name: "paid", type: "uint256" }],
  },
  {
    type: "function",
    name: "quote",
    stateMutability: "view",
    inputs: [],
    outputs: [
      { name: "apyBps", type: "uint256" },
      { name: "depositFeeBps", type: "uint256" },
      { name: "riskTag", type: "string" },
    ],
  },
  {
    type: "function",
    name: "positionOf",
    stateMutability: "view",
    inputs: [{ name: "user", type: "address" }],
    outputs: [
      { name: "principal", type: "uint256" },
      { name: "since", type: "uint256" },
      { name: "accrued", type: "uint256" },
    ],
  },
  {
    type: "event",
    name: "Deposited",
    inputs: [
      { name: "user", type: "address", indexed: true },
      { name: "assetsIn", type: "uint256", indexed: false },
      { name: "fee", type: "uint256", indexed: false },
      { name: "credited", type: "uint256", indexed: false },
    ],
  },
] as const;

// Canonical ERC-8004 IdentityRegistry (ERC-721 "AgentIdentity", v2.0.0).
// Agents are NFTs; evolution data is stored as ERC-8004 metadata entries.
export const ERC8004_REGISTRY_ABI = [
  {
    type: "function",
    name: "register",
    stateMutability: "nonpayable",
    inputs: [{ name: "tokenURI", type: "string" }],
    outputs: [{ name: "agentId", type: "uint256" }],
  },
  {
    type: "function",
    name: "setMetadata",
    stateMutability: "nonpayable",
    inputs: [
      { name: "agentId", type: "uint256" },
      { name: "key", type: "string" },
      { name: "value", type: "bytes" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "getMetadata",
    stateMutability: "view",
    inputs: [
      { name: "agentId", type: "uint256" },
      { name: "key", type: "string" },
    ],
    outputs: [{ name: "", type: "bytes" }],
  },
  {
    type: "function",
    name: "ownerOf",
    stateMutability: "view",
    inputs: [{ name: "tokenId", type: "uint256" }],
    outputs: [{ name: "", type: "address" }],
  },
  {
    type: "function",
    name: "tokenURI",
    stateMutability: "view",
    inputs: [{ name: "tokenId", type: "uint256" }],
    outputs: [{ name: "", type: "string" }],
  },
  {
    // Standard ERC-721 mint event — tokenId is the minted agentId.
    type: "event",
    name: "Transfer",
    inputs: [
      { name: "from", type: "address", indexed: true },
      { name: "to", type: "address", indexed: true },
      { name: "tokenId", type: "uint256", indexed: true },
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
