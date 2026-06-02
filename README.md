# Axion

**A self-evolving agentic wallet on Mantle that commits its decision paths before acting, verifies outcomes, and turns every result into on-chain memory and strategy evolution.**

> Most AI wallets act first and explain later. **Axion commits before it acts.**
> Predict → Commit → Execute → Judge → Forge → Evolve.

Built for the **Mantle Turing Test Hackathon 2026** · Track: **Agentic Wallets & Economy**.

---

## The problem

AI wallets are starting to manage real on-chain value, but most still act like black boxes. They execute first and explain later. Users cannot verify what the agent predicted, what options it considered, what risks it ignored, or whether it actually learned. In Web3, one bad approval, wrong route, or unsafe contract call can cost real funds.

## The solution

Axion turns every wallet action into a **verifiable intelligence cycle**:

1. **Predict** — turn a goal into multiple decision branches with explicit risk, confidence and reasons.
2. **Commit** — hash the whole decision tree and commit the hashes *before* any action. Once committed, the prediction is frozen.
3. **Execute** — run the selected branch through approved skills, behind hard safety gates.
4. **Judge** — compare the realised outcome against the committed prediction. No retconning.
5. **Forge** — rewrite strategy weights from the verified result (the internal *EchoForge* mechanism).
6. **Evolve** — update the trust score, wallet permission level, memory root and strategy version.

Because the prediction is committed before acting, **Axion cannot fake its reasoning after the fact**.

## Why it is a new primitive

- A wallet that **cannot rewrite its reasoning**.
- A wallet whose **memory becomes trust** — the trust score sets the wallet's permission level.
- A wallet whose **verified outcomes forge its next strategy version**.

It is not a dashboard, a trading bot, a yield recommender, or a chatbot.

---

## Features

- Full lifecycle console: goal → decision tree → commit → execute → verify → forge → evolve.
- Deterministic A/B/C/D decision-tree engine with risk/yield/liquidity/approval scoring.
- Pre-commitment hashing (keccak256 over canonical JSON) of goal, tree, selected branch and policy.
- Skill execution through a swappable **ByrealSkillAdapter** (local demo adapter included).
- Outcome verification with five verdicts: Correct, Partially correct, Wrong, Rejected safely, Unsafe blocked.
- EchoForge strategy evolution + trust score + wallet permission tiers.
- Append-only memory root chaining (each epoch hashes the previous root).
- ERC-8004-style agent identity and a Chronos timeline of judged epochs.
- Optional LLM-authored post-mortems (works fully without an API key).
- Local demo mode (localStorage) and optional on-chain mode on Mantle — same lifecycle, same code.
- Premium dark, futuristic UI; copy-to-clipboard hashes; explorer links; loading/empty/error states.

## Architecture

```
axion/
├── contracts/                 # Hardhat project (Solidity 0.8.24)
│   ├── contracts/
│   │   ├── AxionAgentRegistry.sol     # identity, trust, memory root, strategy version
│   │   ├── DecisionCommitmentLog.sol  # pre-execution decision-tree commitments
│   │   ├── EpochMemoryLog.sol         # judged epochs (verdict + score + roots)
│   │   └── AxionPolicyVault.sol       # on-chain spend / slippage / approval policy
│   ├── scripts/deploy.ts      # deploys all four contracts, writes deployments/<network>.json
│   ├── test/axion.test.ts     # full test suite for all four contracts
│   └── hardhat.config.ts      # hardhat, localhost, mantleSepolia (5003), mantle (5000)
│
├── web/                       # Next.js 14 App Router + TypeScript + Tailwind
│   ├── app/
│   │   ├── page.tsx                   # landing
│   │   ├── console/page.tsx           # main agent console (the lifecycle)
│   │   ├── identity/page.tsx          # ERC-8004 identity + Chronos timeline
│   │   ├── about/page.tsx             # how it works
│   │   └── api/postmortem/route.ts    # optional LLM post-mortem, deterministic fallback
│   ├── components/            # DecisionTree, ExecutionView, EpochView, PolicyCard, ...
│   ├── lib/                   # the agent brain (see below)
│   └── types/                 # shared TypeScript types
│
└── docs/
    ├── SUBMISSION.md          # DoraHacks submission copy
    └── DEMO_SCRIPT.md         # 5-minute demo script
```

### The agent brain (`web/lib`)

| File | Responsibility |
|---|---|
| `mockRoutes.ts` | Simulated, clearly-labelled DeFi routes (High APY / Balanced / Hold). |
| `decisionTree.ts` | Scores routes against policy + strategy, builds the A/B/C/D tree, selects a branch. |
| `hashing.ts` | Canonical keccak256 hashing of goal/tree/branch/policy/action/outcome + memory-root chaining. |
| `byrealAdapter.ts` | `ByrealSkillAdapter` interface + local adapter; runs skills and produces an execution result. |
| `strategyForge.ts` | Prediction, verdict judging, epoch scoring, EchoForge strategy evolution, post-mortems. |
| `trustScore.ts` | Trust deltas, clamping, and permission-level tiers. |
| `agentEngine.ts` | Orchestrates judge → score → post-mortem → forge → memory-root → identity update. |
| `storage.ts` | localStorage persistence of agent, policy, strategy, trees, commitments, epochs. |
| `contractClient.ts` | viem clients; on-chain register/commit/writeEpoch with automatic local fallback. |
| `config.ts` / `abis.ts` | Chain config, contract addresses, explorer links, ABIs. |

---

## Smart contracts

All in Solidity `0.8.24`, optimizer on. Events are emitted for every major action (`AgentRegistered`, `DecisionTreeCommitted`, `EpochWritten`, `StrategyUpdated`, `MemoryRootUpdated`, `TrustScoreUpdated`, `PolicySet`, ...).

- **AxionAgentRegistry** — `registerAgent`, `updateMemoryRoot`, `updateStrategyVersion`, `updateTrustScore`, `incrementEpochCount`, `getAgent`, `getOwnerAgents`. Trust starts at 70; strategy version cannot decrease; trust capped at 100.
- **DecisionCommitmentLog** — `commitDecisionTree`, `getCommitment`, `getAgentCommitments`.
- **EpochMemoryLog** — `writeEpoch`, `getEpoch`, `getAgentEpochs`. Verdict enum: `Correct, PartiallyCorrect, Wrong, RejectedSafely, UnsafeBlocked`.
- **AxionPolicyVault** — `setPolicy`, `checkPolicy` (returns `(ok, reasonCode)`), `getPolicy`, `getAllowedAssets`, `getAllowedProtocols`, `pause`, `unpause`.

---

## Frontend pages

- **Landing** — what Axion is, the problem, the lifecycle, and a CTA to the console.
- **Console** — the main page. Enter a goal, generate the decision tree, commit it, execute the selected branch, verify the outcome, and forge the upgrade. A lifecycle stepper tracks progress; the policy card and agent snapshot sit alongside.
- **Identity** — the ERC-8004-style identity with trust score, strategy version, memory root and lifetime stats, plus the Chronos timeline of expandable epoch cards.
- **How it works** — pre-commitment, judging, EchoForge, ERC-8004 and Mantle, plus an explicit honesty section.

---

## Demo flow

1. Open **Console** and click **Initialise agent** (local mode needs nothing else).
2. Keep the default goal — *"Use 100 test USDC to find a low-risk yield opportunity on Mantle. Avoid unsafe approvals and high slippage."* — and click **Generate decision tree**.
3. Review branches A–D. The high-APY route (A) is flagged unsafe and rejected; the balanced route (B) is selected. Click **Commit decision tree** (hashes are frozen here).
4. Click **Execute selected branch** to run the skills and see the realised outcome.
5. Click **Verify outcome** to judge reality vs the committed prediction and read the post-mortem.
6. Click **Forge upgrade & evolve** — watch the trust score, strategy version and memory root change, then open **Identity** to see the new epoch on the timeline.

Try variations: toggle **Allow unsafe approvals** in the policy card and re-run to see branch A become eligible; **Pause policy** to force a safe rejection (branch D).

---

## Local setup

Requirements: Node.js 18+ (tested on Node 22) and npm.

### Web app

```bash
cd web
cp .env.example .env.local      # optional; the app runs with no edits
npm install
npm run dev                     # http://localhost:3000
```

Production build / checks:

```bash
npm run build
npm run typecheck
npm run lint
```

### Contracts

```bash
cd contracts
cp .env.example .env            # only needed for testnet/mainnet deploys
npm install
npx hardhat test                # runs the full suite on the in-process Hardhat network
```

---

## Environment variables

`web/.env.example`:

```
NEXT_PUBLIC_CHAIN_ID=5003
NEXT_PUBLIC_MANTLE_RPC_URL=https://rpc.sepolia.mantle.xyz
NEXT_PUBLIC_EXPLORER_URL=https://sepolia.mantlescan.xyz
NEXT_PUBLIC_AGENT_REGISTRY_ADDRESS=
NEXT_PUBLIC_DECISION_LOG_ADDRESS=
NEXT_PUBLIC_EPOCH_LOG_ADDRESS=
PRIVATE_KEY=
MANTLE_RPC_URL=
OPENAI_API_KEY=
BYREAL_API_KEY=
```

The app works with **all of these blank**: it runs in local demo mode, uses deterministic post-mortems, and persists to localStorage. Fill the contract addresses (and connect an injected wallet) to switch the exact same lifecycle to on-chain mode. `OPENAI_API_KEY` only enriches post-mortems; nothing breaks without it.

---

## Deployment instructions (Mantle)

```bash
cd contracts
cp .env.example .env
# set PRIVATE_KEY (funded with Mantle Sepolia test MNT) and MANTLE_RPC_URL

npx hardhat run scripts/deploy.ts --network mantleSepolia
```

The script deploys all four contracts, writes `deployments/mantleSepolia.json`, and prints the `NEXT_PUBLIC_*` lines to paste into `web/.env.local`. Restart the web app and the console will register agents, commit trees and write epochs on Mantle. Mantle Sepolia: chain id **5003**, RPC `https://rpc.sepolia.mantle.xyz`, explorer `https://sepolia.mantlescan.xyz`. Mainnet config (chain id 5000) is included.

---

## How to run tests

- **Contracts:** `cd contracts && npx hardhat test` — covers registry defaults/events/updates/access control, commitment logging, epoch logging and policy checks.
- **Web type safety:** `cd web && npm run typecheck`.
- **Web lint + build:** `cd web && npm run lint && npm run build`.

---

## What is real and what is simulated

- **Real:** the lifecycle, deterministic canonical hashing, judging logic, EchoForge strategy evolution, trust/permission updates, memory-root chaining, local persistence, and the Solidity contracts.
- **Simulated and labelled:** the DeFi yield routes and their outcomes, so the demo is reliable without live protocol risk. The UI says so plainly.
- **Swappable:** skill execution runs through `ByrealSkillAdapter`; the local adapter can be replaced with a real Byreal Skills backend without touching the lifecycle. No nonexistent SDKs are imported.

## Future roadmap

- Replace the local skill adapter with a live Byreal Skills backend.
- Wire real Mantle DeFi routes behind the same adapter interface.
- Move policy enforcement fully on-chain via `AxionPolicyVault.checkPolicy` as a pre-execution guard.
- Publish ERC-8004 metadata and memory roots to IPFS and verify the chain in-app.
- Multi-agent comparison and a public trust leaderboard.

---

*Internal architecture names: **Nexus** = pre-committed decision trees, **Chronos** = the permanent intelligence timeline, **EchoForge** = the strategy-forging mechanism. The public product is **Axion**.*
