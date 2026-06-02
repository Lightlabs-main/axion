import {
  createPublicClient,
  createWalletClient,
  custom,
  http,
  type Address,
  type Hash,
} from "viem";
import {
  AGENT_REGISTRY_ABI,
  DECISION_LOG_ABI,
  EPOCH_LOG_ABI,
  VERDICT_ENUM,
} from "./abis";
import {
  CHAIN_ID,
  CONTRACTS,
  MANTLE_RPC_URL,
  MANTLE_SEPOLIA,
  isOnchainConfigured,
} from "./config";
import type { Verdict } from "@/types";

// EIP-1193 provider typing (window.ethereum).
declare global {
  interface Window {
    ethereum?: {
      request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
      on?: (event: string, handler: (...args: unknown[]) => void) => void;
      removeListener?: (event: string, handler: (...args: unknown[]) => void) => void;
    };
  }
}

const chain = {
  ...MANTLE_SEPOLIA,
  id: CHAIN_ID,
} as const;

export function hasInjectedWallet(): boolean {
  return typeof window !== "undefined" && Boolean(window.ethereum);
}

export function canTransactOnchain(): boolean {
  return isOnchainConfigured() && hasInjectedWallet();
}

let publicClient: ReturnType<typeof createPublicClient> | null = null;
function getPublicClient() {
  if (!publicClient) {
    publicClient = createPublicClient({
      chain,
      transport: http(MANTLE_RPC_URL),
    });
  }
  return publicClient;
}

export async function connectWallet(): Promise<Address | null> {
  if (!hasInjectedWallet()) return null;
  const accounts = (await window.ethereum!.request({
    method: "eth_requestAccounts",
  })) as string[];
  return (accounts?.[0] as Address) ?? null;
}

async function getWalletClient() {
  if (!hasInjectedWallet()) throw new Error("No injected wallet");
  return createWalletClient({ chain, transport: custom(window.ethereum!) });
}

export interface OnchainResult {
  mode: "onchain" | "local";
  txHash?: string;
  id?: string;
}

/**
 * Register an agent on-chain if configured + wallet connected, otherwise return
 * local mode. The caller treats both paths uniformly.
 */
export async function registerAgentOnchain(
  account: Address,
  name: string,
  metadataURI: string
): Promise<OnchainResult> {
  if (!canTransactOnchain()) return { mode: "local" };
  const wallet = await getWalletClient();
  const hash = (await wallet.writeContract({
    account,
    address: CONTRACTS.agentRegistry as Address,
    abi: AGENT_REGISTRY_ABI,
    functionName: "registerAgent",
    args: [name, metadataURI],
  })) as Hash;
  await getPublicClient().waitForTransactionReceipt({ hash });
  return { mode: "onchain", txHash: hash };
}

export async function commitDecisionTreeOnchain(
  account: Address,
  agentId: bigint,
  goalHash: `0x${string}`,
  treeHash: `0x${string}`,
  selectedBranchHash: `0x${string}`,
  policyHash: `0x${string}`,
  strategyVersion: bigint
): Promise<OnchainResult> {
  if (!canTransactOnchain()) return { mode: "local" };
  const wallet = await getWalletClient();
  const hash = (await wallet.writeContract({
    account,
    address: CONTRACTS.decisionLog as Address,
    abi: DECISION_LOG_ABI,
    functionName: "commitDecisionTree",
    args: [agentId, goalHash, treeHash, selectedBranchHash, policyHash, strategyVersion],
  })) as Hash;
  await getPublicClient().waitForTransactionReceipt({ hash });
  return { mode: "onchain", txHash: hash };
}

export async function writeEpochOnchain(
  account: Address,
  agentId: bigint,
  commitmentId: bigint,
  actionHash: `0x${string}`,
  outcomeHash: `0x${string}`,
  postMortemHash: `0x${string}`,
  verdict: Verdict,
  score: bigint,
  newMemoryRoot: `0x${string}`,
  newStrategyVersion: bigint
): Promise<OnchainResult> {
  if (!canTransactOnchain()) return { mode: "local" };
  const wallet = await getWalletClient();
  const hash = (await wallet.writeContract({
    account,
    address: CONTRACTS.epochLog as Address,
    abi: EPOCH_LOG_ABI,
    functionName: "writeEpoch",
    args: [
      agentId,
      commitmentId,
      actionHash,
      outcomeHash,
      postMortemHash,
      VERDICT_ENUM[verdict],
      score,
      newMemoryRoot,
      newStrategyVersion,
    ],
  })) as Hash;
  await getPublicClient().waitForTransactionReceipt({ hash });
  return { mode: "onchain", txHash: hash };
}
