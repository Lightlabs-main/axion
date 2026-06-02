// Runtime configuration read from public env vars. Everything has a safe
// default so the app works fully in local/demo mode without any setup.

export const CHAIN_ID = Number(process.env.NEXT_PUBLIC_CHAIN_ID ?? "5003");

export const MANTLE_RPC_URL =
  process.env.NEXT_PUBLIC_MANTLE_RPC_URL ?? "https://rpc.sepolia.mantle.xyz";

export const EXPLORER_URL =
  process.env.NEXT_PUBLIC_EXPLORER_URL ?? "https://sepolia.mantlescan.xyz";

export const CONTRACTS = {
  agentRegistry: process.env.NEXT_PUBLIC_AGENT_REGISTRY_ADDRESS ?? "",
  decisionLog: process.env.NEXT_PUBLIC_DECISION_LOG_ADDRESS ?? "",
  epochLog: process.env.NEXT_PUBLIC_EPOCH_LOG_ADDRESS ?? "",
  policyVault: process.env.NEXT_PUBLIC_POLICY_VAULT_ADDRESS ?? "",
} as const;

/** On-chain mode is enabled only when the core contract addresses are set. */
export function isOnchainConfigured(): boolean {
  return Boolean(
    CONTRACTS.agentRegistry &&
      CONTRACTS.decisionLog &&
      CONTRACTS.epochLog &&
      isAddress(CONTRACTS.agentRegistry)
  );
}

function isAddress(value: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test(value);
}

export function txExplorerLink(txHash: string): string {
  return `${EXPLORER_URL.replace(/\/$/, "")}/tx/${txHash}`;
}

export function addressExplorerLink(address: string): string {
  return `${EXPLORER_URL.replace(/\/$/, "")}/address/${address}`;
}

export const MANTLE_SEPOLIA = {
  id: CHAIN_ID,
  name: "Mantle Sepolia",
  nativeCurrency: { name: "Mantle", symbol: "MNT", decimals: 18 },
  rpcUrls: { default: { http: [MANTLE_RPC_URL] }, public: { http: [MANTLE_RPC_URL] } },
  blockExplorers: { default: { name: "MantleScan", url: EXPLORER_URL } },
} as const;
