/**
 * End-to-end proof that the FULL Axion lifecycle works as real on-chain
 * transactions: register → commit → execute (deposit) → judge → forge (epoch)
 * → evolve identity. Run against a deployed set of addresses
 * (deployments/<network>.json). Used to validate the real build on a local
 * Hardhat node before testnet deployment.
 */
import { ethers, network } from "hardhat";
import * as fs from "fs";
import * as path from "path";

const k = (s: string) => ethers.keccak256(ethers.toUtf8Bytes(s));
const USDC = (n: number) => BigInt(Math.round(n * 1e6));

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error("ASSERT FAILED: " + msg);
  console.log("  ✓ " + msg);
}

async function main() {
  const file = path.join(__dirname, "..", "deployments", `${network.name}.json`);
  if (!fs.existsSync(file)) throw new Error(`No deployment file at ${file}. Run deploy first.`);
  const dep = JSON.parse(fs.readFileSync(file, "utf8"));
  const c = dep.contracts;
  const [signer] = await ethers.getSigners();
  console.log("Lifecycle E2E on", network.name, "as", signer.address, "\n");

  const registry = await ethers.getContractAt("AxionAgentRegistry", c.AxionAgentRegistry);
  const decisionLog = await ethers.getContractAt("DecisionCommitmentLog", c.DecisionCommitmentLog);
  const epochLog = await ethers.getContractAt("EpochMemoryLog", c.EpochMemoryLog);
  const usdc = await ethers.getContractAt("MockUSDC", c.MockUSDC);
  const vault = await ethers.getContractAt("AxionYieldVault", c.BalancedVault);

  // 1) REGISTER
  console.log("1) Register agent");
  let rc = await (await registry.registerAgent("Axion", "ipfs://axion/erc8004.json")).wait();
  const regEvt = rc!.logs
    .map((l) => { try { return registry.interface.parseLog(l); } catch { return null; } })
    .find((e) => e?.name === "AgentRegistered");
  const agentId: bigint = regEvt!.args.agentId;
  assert(agentId > 0n, `agentId captured from event = ${agentId}`);

  // 2) COMMIT
  console.log("2) Commit decision tree");
  rc = await (
    await decisionLog.commitDecisionTree(
      agentId,
      k("goal:low-risk-yield"),
      k("tree:ABCD"),
      k("branch:B"),
      k("policy:v1"),
      1
    )
  ).wait();
  const comEvt = rc!.logs
    .map((l) => { try { return decisionLog.interface.parseLog(l); } catch { return null; } })
    .find((e) => e?.name === "DecisionTreeCommitted");
  const commitmentId: bigint = comEvt!.args.commitmentId;
  assert(commitmentId > 0n, `commitmentId captured = ${commitmentId}`);

  // 3) EXECUTE — real deposit into the balanced vault
  console.log("3) Execute selected branch (real deposit)");
  const [apyBps, feeBps, tag] = await vault.quote();
  assert(apyBps === 560n && feeBps === 48n && tag === "safe", `vault quote apy=${apyBps} fee=${feeBps} tag=${tag}`);

  const spend = USDC(100);
  await (await usdc.approve(c.BalancedVault, spend)).wait();
  rc = await (await vault.deposit(spend)).wait();
  const depEvt = rc!.logs
    .map((l) => { try { return vault.interface.parseLog(l); } catch { return null; } })
    .find((e) => e?.name === "Deposited");
  const credited: bigint = depEvt!.args.credited;
  assert(credited === USDC(99.52), `credited net of 0.48% fee = ${Number(credited) / 1e6} aUSDC`);

  const [principal] = await vault.positionOf(signer.address);
  assert(principal === USDC(99.52), `on-chain principal = ${Number(principal) / 1e6} aUSDC`);

  // 4) FORGE — write the judged epoch on-chain
  console.log("4) Write judged epoch");
  const newRoot = k("memory-root-after-epoch-1");
  rc = await (
    await epochLog.writeEpoch(
      agentId,
      commitmentId,
      k("action"),
      k("outcome"),
      k("postmortem"),
      0, // Verdict.Correct
      75,
      newRoot,
      2
    )
  ).wait();
  const epEvt = rc!.logs
    .map((l) => { try { return epochLog.interface.parseLog(l); } catch { return null; } })
    .find((e) => e?.name === "EpochWritten");
  const epochId: bigint = epEvt!.args.epochId;
  assert(epochId > 0n, `epochId captured = ${epochId}`);

  // 5) EVOLVE — update on-chain identity
  console.log("5) Evolve on-chain identity");
  await (await registry.updateTrustScore(agentId, 75)).wait();
  await (await registry.updateStrategyVersion(agentId, 2)).wait();
  await (await registry.updateMemoryRoot(agentId, newRoot)).wait();
  await (await registry.incrementEpochCount(agentId)).wait();

  const agent = await registry.getAgent(agentId);
  assert(agent.trustScore === 75n, `trustScore evolved to ${agent.trustScore}`);
  assert(agent.strategyVersion === 2n, `strategyVersion evolved to ${agent.strategyVersion}`);
  assert(agent.memoryRoot === newRoot, "memoryRoot chained on-chain");
  assert(agent.totalEpochs === 1n, `totalEpochs = ${agent.totalEpochs}`);

  // 6) READ BACK — history is queryable
  console.log("6) Read back on-chain history");
  const commitIds = await decisionLog.getAgentCommitments(agentId);
  const epochIds = await epochLog.getAgentEpochs(agentId);
  assert(commitIds.length === 1 && commitIds[0] === commitmentId, "commitment indexed under agent");
  assert(epochIds.length === 1 && epochIds[0] === epochId, "epoch indexed under agent");
  const ep = await epochLog.getEpoch(epochId);
  assert(ep.verdict === 0n && ep.score === 75n, "epoch readable with correct verdict + score");

  console.log("\n✅ Full lifecycle verified on-chain end-to-end.");
}

main().catch((e) => {
  console.error("\n❌", e.message ?? e);
  process.exitCode = 1;
});
