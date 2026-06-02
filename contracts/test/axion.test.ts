import { expect } from "chai";
import { ethers } from "hardhat";

describe("Axion contracts", () => {
  describe("AxionAgentRegistry", () => {
    it("registers an agent with sane defaults", async () => {
      const [owner] = await ethers.getSigners();
      const Registry = await ethers.getContractFactory("AxionAgentRegistry");
      const registry = await Registry.deploy();

      const tx = await registry.registerAgent("Axion-001", "ipfs://meta");
      await tx.wait();

      const agent = await registry.getAgent(1);
      expect(agent.agentId).to.equal(1n);
      expect(agent.owner).to.equal(owner.address);
      expect(agent.agentName).to.equal("Axion-001");
      expect(agent.strategyVersion).to.equal(1n);
      expect(agent.trustScore).to.equal(70n);
      expect(agent.totalEpochs).to.equal(0n);
    });

    it("emits AgentRegistered", async () => {
      const Registry = await ethers.getContractFactory("AxionAgentRegistry");
      const registry = await Registry.deploy();
      await expect(registry.registerAgent("A", "uri"))
        .to.emit(registry, "AgentRegistered");
    });

    it("updates memory root, strategy version and trust score", async () => {
      const Registry = await ethers.getContractFactory("AxionAgentRegistry");
      const registry = await Registry.deploy();
      await registry.registerAgent("A", "uri");

      const root = ethers.keccak256(ethers.toUtf8Bytes("memory-root-1"));
      await expect(registry.updateMemoryRoot(1, root))
        .to.emit(registry, "MemoryRootUpdated");
      await expect(registry.updateStrategyVersion(1, 2))
        .to.emit(registry, "StrategyUpdated");
      await expect(registry.updateTrustScore(1, 88))
        .to.emit(registry, "TrustScoreUpdated");

      const agent = await registry.getAgent(1);
      expect(agent.memoryRoot).to.equal(root);
      expect(agent.strategyVersion).to.equal(2n);
      expect(agent.trustScore).to.equal(88n);
    });

    it("blocks non-owners and invalid updates", async () => {
      const [, other] = await ethers.getSigners();
      const Registry = await ethers.getContractFactory("AxionAgentRegistry");
      const registry = await Registry.deploy();
      await registry.registerAgent("A", "uri");

      await expect(
        registry.connect(other).updateTrustScore(1, 50)
      ).to.be.revertedWith("Axion: not agent owner");
      await expect(registry.updateTrustScore(1, 101)).to.be.revertedWith(
        "Axion: trust score out of range"
      );
      await expect(registry.updateStrategyVersion(1, 0)).to.be.revertedWith(
        "Axion: version cannot decrease"
      );
    });
  });

  describe("DecisionCommitmentLog", () => {
    it("commits a decision tree and reads it back", async () => {
      const Log = await ethers.getContractFactory("DecisionCommitmentLog");
      const log = await Log.deploy();

      const goalHash = ethers.keccak256(ethers.toUtf8Bytes("goal"));
      const treeHash = ethers.keccak256(ethers.toUtf8Bytes("tree"));
      const branchHash = ethers.keccak256(ethers.toUtf8Bytes("branchB"));
      const policyHash = ethers.keccak256(ethers.toUtf8Bytes("policy"));

      await expect(
        log.commitDecisionTree(1, goalHash, treeHash, branchHash, policyHash, 1)
      ).to.emit(log, "DecisionTreeCommitted");

      const c = await log.getCommitment(1);
      expect(c.agentId).to.equal(1n);
      expect(c.goalHash).to.equal(goalHash);
      expect(c.treeHash).to.equal(treeHash);
      expect(c.selectedBranchHash).to.equal(branchHash);

      const ids = await log.getAgentCommitments(1);
      expect(ids.length).to.equal(1);
      expect(ids[0]).to.equal(1n);
    });
  });

  describe("EpochMemoryLog", () => {
    it("writes a judged epoch and reads it back", async () => {
      const Log = await ethers.getContractFactory("EpochMemoryLog");
      const log = await Log.deploy();

      const actionHash = ethers.keccak256(ethers.toUtf8Bytes("action"));
      const outcomeHash = ethers.keccak256(ethers.toUtf8Bytes("outcome"));
      const pmHash = ethers.keccak256(ethers.toUtf8Bytes("postmortem"));
      const memRoot = ethers.keccak256(ethers.toUtf8Bytes("root"));

      // Verdict.Correct == 0
      await expect(
        log.writeEpoch(1, 1, actionHash, outcomeHash, pmHash, 0, 75, memRoot, 2)
      ).to.emit(log, "EpochWritten");

      const e = await log.getEpoch(1);
      expect(e.agentId).to.equal(1n);
      expect(e.verdict).to.equal(0n);
      expect(e.score).to.equal(75n);
      expect(e.newStrategyVersion).to.equal(2n);

      const ids = await log.getAgentEpochs(1);
      expect(ids.length).to.equal(1);
    });
  });

  describe("AxionPolicyVault", () => {
    it("sets a policy and enforces checks", async () => {
      const Vault = await ethers.getContractFactory("AxionPolicyVault");
      const vault = await Vault.deploy();

      await vault.setPolicy(
        1,
        100_000_000, // maxSpend (100 USDC, 6 decimals)
        50, // maxSlippageBps = 0.50%
        false, // unsafe approvals not allowed
        ["USDC"],
        ["BalancedYield"]
      );

      // Safe action within limits -> ok
      let [ok, code] = await vault.checkPolicy(1, 100_000_000, 40, false);
      expect(ok).to.equal(true);
      expect(code).to.equal(0n);

      // Slippage too high -> reason 3
      [ok, code] = await vault.checkPolicy(1, 100_000_000, 180, false);
      expect(ok).to.equal(false);
      expect(code).to.equal(3n);

      // Unsafe approval -> reason 4
      [ok, code] = await vault.checkPolicy(1, 100_000_000, 40, true);
      expect(ok).to.equal(false);
      expect(code).to.equal(4n);

      // Pause -> reason 1
      await vault.pause(1);
      [ok, code] = await vault.checkPolicy(1, 1, 1, false);
      expect(ok).to.equal(false);
      expect(code).to.equal(1n);
    });
  });
});
