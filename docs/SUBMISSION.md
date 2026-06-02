# Axion — DoraHacks Submission

**Project name:** Axion

## One-liner

Axion is a self-evolving agentic wallet on Mantle that commits decision paths before acting, verifies outcomes, and turns every result into on-chain memory and strategy evolution.

## Problem

AI wallets are starting to manage real on-chain value, but most still act like black boxes. They execute first, then explain later. Users cannot verify what the agent predicted, what options it considered, what risks it ignored, or whether it actually learned from mistakes.

## Solution

Axion turns every wallet action into a verifiable intelligence cycle: **Predict → Commit → Execute → Judge → Forge → Evolve.** Before acting, Axion creates multiple decision paths and commits them on-chain. After execution, it compares the result with its original prediction, writes a post-mortem into its ERC-8004 memory, and updates its strategy for the next action.

## Vision

Axion's vision is to make autonomous wallets trustworthy enough to manage real Web3 value. AI wallets should not just act on-chain. They should prove how they think, learn from outcomes, and earn trust through public verified evolution.

## Track

Agentic Wallets & Economy.

## Demo

The user connects a wallet, mints test aUSDC from the faucet, and gives Axion a low-risk yield goal. Axion generates multiple branches, rejects the unsafe high-APY route, and commits its decision tree on Mantle. It then **deposits real test USDC into a deployed AxionYieldVault** through a Byreal-style skill adapter, reads the realised APY and entry fee back from chain, verifies the outcome against its committed prediction, writes a judged epoch on-chain, and updates its strategy version, memory root and trust score — all as real Mantle transactions with explorer links.

## What makes it different

Axion is not a dashboard, a trading bot, a yield recommender, or a chatbot. It is a new primitive: a wallet that cannot rewrite its reasoning, whose memory becomes trust, and whose verified outcomes forge its next strategy version. The trust score is not cosmetic — it sets the wallet's permission level (read-only → suggest → execute low-value → higher autonomy).

## Tech

Next.js 14 (App Router) + TypeScript + Tailwind; Solidity 0.8.24 contracts on Mantle — AxionAgentRegistry, DecisionCommitmentLog, EpochMemoryLog, AxionPolicyVault, plus a real ERC-20 test USDC (MockUSDC) and AxionYieldVault for the on-chain execution layer; viem for chain access (real wallet connect, network switching, event-log id capture); deterministic agent engine with optional LLM-enriched post-mortems that safely fall back when no key is present. The full lifecycle runs as real Mantle transactions; a `lifecycle-e2e` script proves it end-to-end on-chain. The aUSDC token and vaults are test contracts deployed by Axion, clearly labelled in the UI, and swappable for live Mantle protocols behind the same adapter.
