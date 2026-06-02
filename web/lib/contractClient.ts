import {
  createPublicClient,
  createWalletClient,
  custom,
  http,
  parseEventLogs,
  type Address,
  type Hash,
} from "viem";
import {
  AGENT_REGISTRY_ABI,
  DECISION_LOG_ABI,
  EPOCH_LOG_ABI,
  ERC20_ABI,
  VAULT_ABI,
  VERDICT_ENUM,
} from "./abis";
import {
  ACTIVE_CHAIN_PARAMS,
  CHAIN_HEX,
  CHAIN_ID,
  CONTRACTS,
  MANTLE_RPC_URL,
  USDC_DECIMALS,
  VIEM_CHAIN,
  isOnchainConfigured,
} from "./config";
import type { Verdict } from "@/types";

declare global {
  interface Window {
    ethereum?: {
      request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
      on?: (event: string, handler: (...args: unknown[]) => void) => void;
      removeListener?: (event: string, handler: (...args: unknown[]) => void) => void;
    };
  }
}

export function hasInjectedWallet(): boolean {
  return typeof window !== "undefined" && Boolean(window.ethereum);
}

/** True only when contracts are configured AND a browser wallet is present. */
export function canTransactOnchain(): boolean {
  return isOnchainConfigured() && hasInjectedWallet();
}

let publicClient: ReturnType<typeof createPublicClient> | null = null;
function getPublicClient() {
  if (!publicClient) {
    publicClient = createPublicClient({
      chain: VIEM_CHAIN,
      transport: http(MANTLE_RPC_URL),
    });
  }
  return publicClient;
}

function getWalletClient() {
  if (!hasInjectedWallet()) throw new Error("No browser wallet detected. Install MetaMask.");
  return createWalletClient({ chain: VIEM_CHAIN, transport: custom(window.ethereum!) });
}

function toUnits(human: number): bigint {
  return BigInt(Math.round(human * 10 ** USDC_DECIMALS));
}
export function fromUnits(units: bigint): number {
  return Number(units) / 10 ** USDC_DECIMALS;
}

/** Return the already-authorised account without prompting, or null. */
export async function getConnectedAccount(): Promise<Address | null> {
  if (!hasInjectedWallet()) return null;
  try {
    const accounts = (await window.ethereum!.request({ method: "eth_accounts" })) as string[];
    return (accounts?.[0] as Address) ?? null;
  } catch {
    return null;
  }
}

/** Connect the wallet and make sure it is on the configured Mantle network. */
export async function connectWallet(): Promise<Address | null> {
  if (!hasInjectedWallet()) return null;
  const accounts = (await window.ethereum!.request({
    method: "eth_requestAccounts",
  })) as string[];
  const account = (accounts?.[0] as Address) ?? null;
  if (account) await ensureChain();
  return account;
}

/** Switch the wallet to the configured chain, adding it if unknown. */
export async function ensureChain(): Promise<void> {
  if (!hasInjectedWallet()) return;
  const current = (await window.ethereum!.request({ method: "eth_chainId" })) as string;
  if (current?.toLowerCase() === CHAIN_HEX.toLowerCase()) return;
  try {
    await window.ethereum!.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: CHAIN_HEX }],
    });
  } catch (err: unknown) {
    const code = (err as { code?: number })?.code;
    if (code === 4902) {
      await window.ethereum!.request({
        method: "wallet_addEthereumChain",
        params: [ACTIVE_CHAIN_PARAMS],
      });
    } else {
      throw err;
    }
  }
}

export async function getChainId(): Promise<number | null> {
  if (!hasInjectedWallet()) return null;
  const hex = (await window.ethereum!.request({ method: "eth_chainId" })) as string;
  return hex ? parseInt(hex, 16) : null;
}

function requireOnchain() {
  if (!isOnchainConfigured()) {
    throw new Error(
      "Contracts are not configured. Deploy to Mantle and set the addresses in web/.env.local."
    );
  }
  if (!hasInjectedWallet()) {
    throw new Error("No browser wallet detected. Install MetaMask to run the real lifecycle.");
  }
}

// ---------------------------------------------------------------------------
// Core lifecycle writes — each returns the REAL on-chain id parsed from logs.
// ---------------------------------------------------------------------------

export interface RegisterResult {
  txHash: string;
  agentId: bigint;
}

export async function registerAgentOnchain(
  account: Address,
  name: string,
  metadataURI: string
): Promise<RegisterResult> {
  requireOnchain();
  await ensureChain();
  const wallet = getWalletClient();
  const hash = (await wallet.writeContract({
    account,
    chain: VIEM_CHAIN,
    address: CONTRACTS.agentRegistry as Address,
    abi: AGENT_REGISTRY_ABI,
    functionName: "registerAgent",
    args: [name, metadataURI],
  })) as Hash;
  const receipt = await getPublicClient().waitForTransactionReceipt({ hash });
  const logs = parseEventLogs({
    abi: AGENT_REGISTRY_ABI,
    eventName: "AgentRegistered",
    logs: receipt.logs,
  });
  const agentId = (logs[0]?.args as { agentId?: bigint })?.agentId ?? 0n;
  return { txHash: hash, agentId };
}

export interface CommitResult {
  txHash: string;
  commitmentId: bigint;
}

export async function commitDecisionTreeOnchain(
  account: Address,
  agentId: bigint,
  goalHash: `0x${string}`,
  treeHash: `0x${string}`,
  selectedBranchHash: `0x${string}`,
  policyHash: `0x${string}`,
  strategyVersion: bigint
): Promise<CommitResult> {
  requireOnchain();
  const wallet = getWalletClient();
  const hash = (await wallet.writeContract({
    account,
    chain: VIEM_CHAIN,
    address: CONTRACTS.decisionLog as Address,
    abi: DECISION_LOG_ABI,
    functionName: "commitDecisionTree",
    args: [agentId, goalHash, treeHash, selectedBranchHash, policyHash, strategyVersion],
  })) as Hash;
  const receipt = await getPublicClient().waitForTransactionReceipt({ hash });
  const logs = parseEventLogs({
    abi: DECISION_LOG_ABI,
    eventName: "DecisionTreeCommitted",
    logs: receipt.logs,
  });
  const commitmentId = (logs[0]?.args as { commitmentId?: bigint })?.commitmentId ?? 0n;
  return { txHash: hash, commitmentId };
}

export interface EpochResult {
  txHash: string;
  epochId: bigint;
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
): Promise<EpochResult> {
  requireOnchain();
  const wallet = getWalletClient();
  const hash = (await wallet.writeContract({
    account,
    chain: VIEM_CHAIN,
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
  const receipt = await getPublicClient().waitForTransactionReceipt({ hash });
  const logs = parseEventLogs({
    abi: EPOCH_LOG_ABI,
    eventName: "EpochWritten",
    logs: receipt.logs,
  });
  const epochId = (logs[0]?.args as { epochId?: bigint })?.epochId ?? 0n;
  return { txHash: hash, epochId };
}

/** Evolve the on-chain identity: trust score, strategy version, memory root. */
export async function evolveIdentityOnchain(
  account: Address,
  agentId: bigint,
  newTrustScore: bigint,
  newStrategyVersion: bigint,
  newMemoryRoot: `0x${string}`
): Promise<string> {
  requireOnchain();
  const wallet = getWalletClient();
  const base = {
    account,
    chain: VIEM_CHAIN,
    address: CONTRACTS.agentRegistry as Address,
    abi: AGENT_REGISTRY_ABI,
  } as const;
  const h1 = (await wallet.writeContract({
    ...base,
    functionName: "updateTrustScore",
    args: [agentId, newTrustScore],
  })) as Hash;
  await getPublicClient().waitForTransactionReceipt({ hash: h1 });
  const h2 = (await wallet.writeContract({
    ...base,
    functionName: "updateStrategyVersion",
    args: [agentId, newStrategyVersion],
  })) as Hash;
  await getPublicClient().waitForTransactionReceipt({ hash: h2 });
  const h3 = (await wallet.writeContract({
    ...base,
    functionName: "updateMemoryRoot",
    args: [agentId, newMemoryRoot],
  })) as Hash;
  await getPublicClient().waitForTransactionReceipt({ hash: h3 });
  const h4 = (await wallet.writeContract({
    ...base,
    functionName: "incrementEpochCount",
    args: [agentId],
  })) as Hash;
  await getPublicClient().waitForTransactionReceipt({ hash: h4 });
  return h1;
}

// ---------------------------------------------------------------------------
// Token + vault (the real execution layer)
// ---------------------------------------------------------------------------

export async function getUsdcBalance(account: Address): Promise<number> {
  if (!isOnchainConfigured()) return 0;
  const units = (await getPublicClient().readContract({
    address: CONTRACTS.usdc as Address,
    abi: ERC20_ABI,
    functionName: "balanceOf",
    args: [account],
  })) as bigint;
  return fromUnits(units);
}

export async function faucetUsdc(account: Address, human: number): Promise<string> {
  requireOnchain();
  await ensureChain();
  const wallet = getWalletClient();
  const hash = (await wallet.writeContract({
    account,
    chain: VIEM_CHAIN,
    address: CONTRACTS.usdc as Address,
    abi: ERC20_ABI,
    functionName: "faucet",
    args: [toUnits(human)],
  })) as Hash;
  await getPublicClient().waitForTransactionReceipt({ hash });
  return hash;
}

export interface VaultQuote {
  apyBps: number;
  depositFeeBps: number;
  riskTag: string;
}

export async function vaultQuote(vault: Address): Promise<VaultQuote> {
  const [apyBps, depositFeeBps, riskTag] = (await getPublicClient().readContract({
    address: vault,
    abi: VAULT_ABI,
    functionName: "quote",
  })) as [bigint, bigint, string];
  return { apyBps: Number(apyBps), depositFeeBps: Number(depositFeeBps), riskTag };
}

export interface VaultPosition {
  principal: number;
  since: number;
  accrued: number;
}

export async function vaultPosition(vault: Address, account: Address): Promise<VaultPosition> {
  const [principal, since, accrued] = (await getPublicClient().readContract({
    address: vault,
    abi: VAULT_ABI,
    functionName: "positionOf",
    args: [account],
  })) as [bigint, bigint, bigint];
  return { principal: fromUnits(principal), since: Number(since), accrued: fromUnits(accrued) };
}

export interface DepositResult {
  txHash: string;
  credited: number;
  feePaid: number;
}

/** Approve (if needed) and deposit real test USDC into a vault. */
export async function depositToVault(
  account: Address,
  vault: Address,
  human: number
): Promise<DepositResult> {
  requireOnchain();
  await ensureChain();
  const wallet = getWalletClient();
  const pub = getPublicClient();
  const amount = toUnits(human);

  const allowance = (await pub.readContract({
    address: CONTRACTS.usdc as Address,
    abi: ERC20_ABI,
    functionName: "allowance",
    args: [account, vault],
  })) as bigint;

  if (allowance < amount) {
    const approveHash = (await wallet.writeContract({
      account,
      chain: VIEM_CHAIN,
      address: CONTRACTS.usdc as Address,
      abi: ERC20_ABI,
      functionName: "approve",
      args: [vault, amount],
    })) as Hash;
    await pub.waitForTransactionReceipt({ hash: approveHash });
  }

  const hash = (await wallet.writeContract({
    account,
    chain: VIEM_CHAIN,
    address: vault,
    abi: VAULT_ABI,
    functionName: "deposit",
    args: [amount],
  })) as Hash;
  const receipt = await pub.waitForTransactionReceipt({ hash });
  const logs = parseEventLogs({ abi: VAULT_ABI, eventName: "Deposited", logs: receipt.logs });
  const args = (logs[0]?.args ?? {}) as { credited?: bigint; fee?: bigint };
  return {
    txHash: hash,
    credited: args.credited ? fromUnits(args.credited) : 0,
    feePaid: args.fee ? fromUnits(args.fee) : 0,
  };
}

export { CHAIN_ID };
