# Axion — 5-Minute Demo Script

A tight, judge-ready walkthrough. The app runs in local demo mode, so nothing needs to be configured beforehand.

## Minute 1 — The problem

Open the **Landing** page. AI wallets are black boxes: they act first and explain later. A post-action explanation is unfalsifiable — the agent can always describe its choice in whatever light flatters the result. In Web3 that is dangerous: one bad approval or route can cost real funds.

> "Most AI wallets act first and explain later. Axion commits before it acts."

## Minute 2 — The goal

Click **Launch Demo** to open the **Console** and **Initialise agent** (local mode). Show the default goal:

> "Use 100 test USDC to find a low-risk yield opportunity on Mantle. Avoid unsafe approvals and high slippage."

Point out the policy card on the right: max spend, max slippage, unsafe approvals blocked, and the wallet's current permission level derived from its trust score.

## Minute 3 — The decision tree (commit before acting)

Click **Generate decision tree**. Walk through the four branches:

- **A · Chase High Yield** — best APY but unsafe approval + slippage over policy → flagged **unsafe / blocked**.
- **B · Balanced Safe Yield** — safe approvals, low slippage, high protocol trust → **selected**.
- **C · Hold USDC** — capital-preserving **fallback**.
- **D · Reject Execution** — used only when nothing is safe.

Show the pre-commitment hashes (goal, tree, selected branch, policy). Click **Commit decision tree**.

> "Every goal becomes a decision tree." These hashes are frozen before any action — Axion cannot rewrite what it predicted.

## Minute 4 — Execution and verification

Click **Execute selected branch**. Show the skill trace running through the Byreal-compatible adapter — RiskCheck, RouteCompare, ApprovalGuard, Execution, OutcomeVerifier — and the realised yield and slippage.

Click **Verify outcome**. Axion compares reality against the committed prediction, assigns a verdict (e.g. *Partially correct*: yield came in slightly below the brochure), and writes a structured post-mortem of what was right and wrong.

> "Every execution becomes a judged epoch."

## Minute 5 — Evolution

Click **Forge upgrade & evolve**. Show the strategy version increment, the trust score change, and the new memory root. EchoForge has nudged the strategy weights based on the verified result. Open the **Identity** page to show the updated ERC-8004-style identity and the new epoch on the Chronos timeline.

> "Every outcome forges the next strategy."

## End line

> "Axion is not just an AI wallet. It is a wallet that proves how it thinks, learns from outcomes, and earns trust over time."

## Optional follow-ups (if time allows)

- Toggle **Allow unsafe approvals** and re-run: branch A becomes eligible — show how policy changes the decision.
- **Pause policy** and re-run: Axion selects branch D and records a **Rejected safely** epoch (a safe rejection is a success, +4 trust).
- Refresh the page: the timeline persists (localStorage).
