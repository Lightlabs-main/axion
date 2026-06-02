# Axion — 5-Minute Demo Script

A tight, judge-ready walkthrough. Prerequisite: contracts deployed to Mantle Sepolia (`npm run deploy:mantle`, which writes `web/.env.local`) and a browser wallet such as MetaMask. Every step below is a real on-chain transaction with an explorer link.

## Minute 1 — The problem

Open the **Landing** page. AI wallets are black boxes: they act first and explain later. A post-action explanation is unfalsifiable — the agent can always describe its choice in whatever light flatters the result. In Web3 that is dangerous: one bad approval or route can cost real funds.

> "Most AI wallets act first and explain later. Axion commits before it acts."

## Minute 2 — The goal

Click **Launch Demo** to open the **Console**. Click **Connect wallet** (it auto-adds/switches to Mantle), then **Get 1,000 test aUSDC** from the faucet, then **Register agent** — a real `registerAgent` transaction mints the on-chain identity (note the agent id). Show the default goal:

> "Use 100 test USDC to find a low-risk yield opportunity on Mantle. Avoid unsafe approvals and high slippage."

Point out the policy card on the right: max spend, max slippage, unsafe approvals blocked, and the wallet's current permission level derived from its trust score.

## Minute 3 — The decision tree (commit before acting)

Click **Generate decision tree**. Walk through the four branches:

- **A · Chase High Yield** — best APY but unsafe approval + slippage over policy → flagged **unsafe / blocked**.
- **B · Balanced Safe Yield** — safe approvals, low slippage, high protocol trust → **selected**.
- **C · Hold USDC** — capital-preserving **fallback**.
- **D · Reject Execution** — used only when nothing is safe.

Show the pre-commitment hashes (goal, tree, selected branch, policy). Click **Commit decision tree** — confirm the wallet transaction and open the linked commitment tx on the explorer.

> "Every goal becomes a decision tree." These hashes are frozen on-chain before any action — Axion cannot rewrite what it predicted.

## Minute 4 — Execution and verification

Click **Execute selected branch**. Axion reads the target vault's on-chain terms (`quote()`), runs the skill trace through the Byreal-compatible adapter — RouteCompare, RiskCheck, ApprovalGuard, Execution, OutcomeVerifier — and **deposits real test aUSDC into the AxionYieldVault**. Open the deposit transaction on the explorer; note the realised APY and the on-chain entry fee.

Click **Verify outcome**. Axion compares the realised on-chain terms against the committed prediction, assigns a verdict, and writes a structured post-mortem of what was right and wrong.

> "Every execution becomes a judged epoch."

## Minute 5 — Evolution

Click **Forge upgrade & evolve**. This writes the judged epoch on-chain (`writeEpoch`) and updates the agent's trust score, strategy version and memory root via real transactions. Open the linked epoch tx, then the **Identity** page to show the updated ERC-8004-style identity and the new epoch on the Chronos timeline.

> "Every outcome forges the next strategy."

## End line

> "Axion is not just an AI wallet. It is a wallet that proves how it thinks, learns from outcomes, and earns trust over time."

## Optional follow-ups (if time allows)

- Toggle **Allow unsafe approvals** and re-run: branch A (the High APY vault) becomes eligible — execution will deposit into the unsafe vault instead, showing how policy changes the real action.
- **Pause policy** and re-run: Axion selects branch D and records a **Rejected safely** epoch (a safe rejection is a success, +4 trust) — no funds move.
- Refresh the page: the timeline persists (local cache of on-chain ids); the canonical record lives on Mantle and can be read back via the contract getters.
