import {
  createPublicClient,
  createWalletClient,
  custom,
  http,
  parseEventLogs,
  stringToHex,
  zeroAddress,
  type Address,
  type Hash,
} from "viem";
import {
  AGENT_REGISTRY_ABI,
  DECISION_LOG_ABI,
  EPOCH_LOG_ABI,
  ERC20_ABI,
  ERC8004_REGISTRY_ABI,
  VAULT_ABI,
  VERDICT_ENUM,
} from "./abis";
import {
  ACTIVE_CHAIN_PARAMS,
  CHAIN_HEX,
  CHAIN_ID,
  CONTRACTS,
  ERC8004_REGISTRY_ADDRESS,
  MANTLE_RPC_URL,
  USDC_DECIMALS,
  VIEM_CHAIN,
  hasErc8004Registry,
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

/** Connect the wallet. Network switching is best-effort — if it fails the UI
 *  shows a "Switch network" button rather than failing the whole connection. */
export async function connectWallet(): Promise<Address | null> {
  if (!hasInjectedWallet()) return null;
  const accounts = (await window.ethereum!.request({
    method: "eth_requestAccounts",
  })) as string[];
  const account = (accounts?.[0] as Address) ?? null;
  if (account) {
    try {
      await ensureChain();
    } catch {
      /* leave the account connected; the UI exposes a Switch network button */
    }
  }
  return account;
}

function errCode(err: unknown): number | undefined {
  const e = err as { code?: number; data?: { originalError?: { code?: number } } };
  return e?.code ?? e?.data?.originalError?.code;
}
function errMessage(err: unknown): string {
  return (err as { message?: string })?.message ?? String(err);
}

/**
 * Switch the wallet to the configured chain, adding it first if the wallet does
 * not know it. Handles the several different error shapes wallets return for an
 * unknown chain, and verifies the switch actually took effect.
 */
export async function ensureChain(): Promise<void> {
  if (!hasInjectedWallet()) return;
  const current = (await window.ethereum!.request({ method: "eth_chainId" })) as string;
  if (current && parseInt(current, 16) === CHAIN_ID) return;

  try {
    await window.ethereum!.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: CHAIN_HEX }],
    });
  } catch (err) {
    const code = errCode(err);
    const notAdded =
      code === 4902 ||
      code === -32603 ||
      /unrecognized chain|not been added|wallet_addethereumchain|add this network/i.test(
        errMessage(err)
      );
    if (!notAdded) throw err;

    // Add the network, then switch (some wallets auto-select after adding).
    await window.ethereum!.request({
      method: "wallet_addEthereumChain",
      params: [ACTIVE_CHAIN_PARAMS],
    });
    const after = (await window.ethereum!.request({ method: "eth_chainId" })) as string;
    if (after && parseInt(after, 16) === CHAIN_ID) return;
    await window.ethereum!.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: CHAIN_HEX }],
    });
  }

  // Final verification.
  const final = (await window.ethereum!.request({ method: "eth_chainId" })) as string;
  if (!final || parseInt(final, 16) !== CHAIN_ID) {
    throw new Error(
      `Could not switch to ${ACTIVE_CHAIN_PARAMS.chainName}. Add it manually: RPC ${ACTIVE_CHAIN_PARAMS.rpcUrls[0]}, chain id ${CHAIN_ID}.`
    );
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
// Identity dispatcher: use the canonical ERC-8004 registry where it exists
// (Mantle mainnet), otherwise Axion's own ERC-8004-aligned registry.
// ---------------------------------------------------------------------------

export type RegistryKind = "erc8004" | "axion";

export function activeRegistryKind(): RegistryKind {
  return hasErc8004Registry() ? "erc8004" : "axion";
}

export interface IdentityResult {
  txHash: string;
  agentId: bigint;
  registry: RegistryKind;
}

/** Register the agent identity, on the canonical ERC-8004 registry if present. */
export async function registerIdentity(
  account: Address,
  name: string,
  metadataURI: string
): Promise<IdentityResult> {
  requireOnchain();
  await ensureChain();

  if (hasErc8004Registry()) {
    const wallet = getWalletClient();
    const hash = (await wallet.writeContract({
      account,
      chain: VIEM_CHAIN,
      address: ERC8004_REGISTRY_ADDRESS as Address,
      abi: ERC8004_REGISTRY_ABI,
      functionName: "register",
      args: [metadataURI],
    })) as Hash;
    const receipt = await getPublicClient().waitForTransactionReceipt({ hash });
    // The mint Transfer (from == 0x0) carries the agentId as tokenId.
    const mint = parseEventLogs({
      abi: ERC8004_REGISTRY_ABI,
      eventName: "Transfer",
      logs: receipt.logs,
    }).find((l) => (l.args as { from?: string }).from === zeroAddress);
    const agentId = (mint?.args as { tokenId?: bigint })?.tokenId ?? 0n;
    return { txHash: hash, agentId, registry: "erc8004" };
  }

  const res = await registerAgentOnchain(account, name, metadataURI);
  return { txHash: res.txHash, agentId: res.agentId, registry: "axion" };
}

/** Evolve the on-chain identity (trust, strategy version, memory root). */
export async function evolveIdentity(
  account: Address,
  agentId: bigint,
  newTrustScore: bigint,
  newStrategyVersion: bigint,
  newMemoryRoot: `0x${string}`
): Promise<string> {
  requireOnchain();

  if (hasErc8004Registry()) {
    // ERC-8004 stores evolution as agent metadata entries.
    const wallet = getWalletClient();
    const pub = getPublicClient();
    const base = {
      account,
      chain: VIEM_CHAIN,
      address: ERC8004_REGISTRY_ADDRESS as Address,
      abi: ERC8004_REGISTRY_ABI,
      functionName: "setMetadata",
    } as const;
    const entries: [string, `0x${string}`][] = [
      ["axion.trustScore", stringToHex(newTrustScore.toString())],
      ["axion.strategyVersion", stringToHex(newStrategyVersion.toString())],
      ["axion.memoryRoot", newMemoryRoot],
    ];
    let first = "";
    for (const [key, value] of entries) {
      const h = (await wallet.writeContract({
        ...base,
        args: [agentId, key, value],
      })) as Hash;
      await pub.waitForTransactionReceipt({ hash: h });
      if (!first) first = h;
    }
    return first;
  }

  return evolveIdentityOnchain(account, agentId, newTrustScore, newStrategyVersion, newMemoryRoot);
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
