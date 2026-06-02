// Runtime configuration read from public env vars. In the REAL build the app
// runs against deployed Mantle contracts; the lifecycle (register → commit →
// execute → judge → forge) is performed as real on-chain transactions.

export const CHAIN_ID = Number(process.env.NEXT_PUBLIC_CHAIN_ID ?? "5003");

export const USDC_DECIMALS = 6;

// Per-chain metadata used for wallet network add/switch and explorer links.
interface ChainMeta {
  id: number;
  name: string;
  rpcUrl: string;
  explorer: string;
}

const CHAINS: Record<number, ChainMeta> = {
  5003: {
    id: 5003,
    name: "Mantle Sepolia",
    rpcUrl: "https://rpc.sepolia.mantle.xyz",
    explorer: "https://sepolia.mantlescan.xyz",
  },
  5000: {
    id: 5000,
    name: "Mantle",
    rpcUrl: "https://rpc.mantle.xyz",
    explorer: "https://mantlescan.xyz",
  },
};

const fallback: ChainMeta = CHAINS[CHAIN_ID] ?? {
  id: CHAIN_ID,
  name: `Chain ${CHAIN_ID}`,
  rpcUrl: process.env.NEXT_PUBLIC_MANTLE_RPC_URL ?? "http://127.0.0.1:8545",
  explorer: process.env.NEXT_PUBLIC_EXPLORER_URL ?? "",
};

export const ACTIVE_CHAIN: ChainMeta = {
  ...fallback,
  rpcUrl: process.env.NEXT_PUBLIC_MANTLE_RPC_URL ?? fallback.rpcUrl,
  explorer: process.env.NEXT_PUBLIC_EXPLORER_URL ?? fallback.explorer,
};

export const MANTLE_RPC_URL = ACTIVE_CHAIN.rpcUrl;
export const EXPLORER_URL = ACTIVE_CHAIN.explorer;

export const CONTRACTS = {
  agentRegistry: process.env.NEXT_PUBLIC_AGENT_REGISTRY_ADDRESS ?? "",
  decisionLog: process.env.NEXT_PUBLIC_DECISION_LOG_ADDRESS ?? "",
  epochLog: process.env.NEXT_PUBLIC_EPOCH_LOG_ADDRESS ?? "",
  policyVault: process.env.NEXT_PUBLIC_POLICY_VAULT_ADDRESS ?? "",
  usdc: process.env.NEXT_PUBLIC_USDC_ADDRESS ?? "",
  balancedVault: process.env.NEXT_PUBLIC_BALANCED_VAULT_ADDRESS ?? "",
  highApyVault: process.env.NEXT_PUBLIC_HIGH_APY_VAULT_ADDRESS ?? "",
} as const;

function isAddress(value: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test(value);
}

/**
 * On-chain mode is enabled only when the full real stack is configured:
 * the three core logs plus the USDC token and the balanced vault that the
 * execution step actually deposits into.
 */
export function isOnchainConfigured(): boolean {
  return (
    isAddress(CONTRACTS.agentRegistry) &&
    isAddress(CONTRACTS.decisionLog) &&
    isAddress(CONTRACTS.epochLog) &&
    isAddress(CONTRACTS.usdc) &&
    isAddress(CONTRACTS.balancedVault)
  );
}

export function txExplorerLink(txHash: string): string {
  if (!EXPLORER_URL) return "#";
  return `${EXPLORER_URL.replace(/\/$/, "")}/tx/${txHash}`;
}

export function addressExplorerLink(address: string): string {
  if (!EXPLORER_URL) return "#";
  return `${EXPLORER_URL.replace(/\/$/, "")}/address/${address}`;
}

export const CHAIN_HEX = `0x${CHAIN_ID.toString(16)}`;

export const ACTIVE_CHAIN_PARAMS = {
  chainId: CHAIN_HEX,
  chainName: ACTIVE_CHAIN.name,
  nativeCurrency: { name: "Mantle", symbol: "MNT", decimals: 18 },
  rpcUrls: [ACTIVE_CHAIN.rpcUrl],
  blockExplorerUrls: EXPLORER_URL ? [EXPLORER_URL] : [],
} as const;

// viem chain object.
export const VIEM_CHAIN = {
  id: CHAIN_ID,
  name: ACTIVE_CHAIN.name,
  nativeCurrency: { name: "Mantle", symbol: "MNT", decimals: 18 },
  rpcUrls: {
    default: { http: [ACTIVE_CHAIN.rpcUrl] },
    public: { http: [ACTIVE_CHAIN.rpcUrl] },
  },
  blockExplorers: EXPLORER_URL
    ? { default: { name: "Explorer", url: EXPLORER_URL } }
    : undefined,
} as const;
