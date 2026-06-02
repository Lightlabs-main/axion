import { ethers, network } from "hardhat";
import * as fs from "fs";
import * as path from "path";

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying Axion contracts with account:", deployer.address);
  console.log("Network:", network.name);

  const Registry = await ethers.getContractFactory("AxionAgentRegistry");
  const registry = await Registry.deploy();
  await registry.waitForDeployment();
  const registryAddress = await registry.getAddress();
  console.log("AxionAgentRegistry:", registryAddress);

  const DecisionLog = await ethers.getContractFactory("DecisionCommitmentLog");
  const decisionLog = await DecisionLog.deploy();
  await decisionLog.waitForDeployment();
  const decisionLogAddress = await decisionLog.getAddress();
  console.log("DecisionCommitmentLog:", decisionLogAddress);

  const EpochLog = await ethers.getContractFactory("EpochMemoryLog");
  const epochLog = await EpochLog.deploy();
  await epochLog.waitForDeployment();
  const epochLogAddress = await epochLog.getAddress();
  console.log("EpochMemoryLog:", epochLogAddress);

  const PolicyVault = await ethers.getContractFactory("AxionPolicyVault");
  const policyVault = await PolicyVault.deploy();
  await policyVault.waitForDeployment();
  const policyVaultAddress = await policyVault.getAddress();
  console.log("AxionPolicyVault:", policyVaultAddress);

  const out = {
    network: network.name,
    chainId: Number((await ethers.provider.getNetwork()).chainId),
    deployer: deployer.address,
    deployedAt: new Date().toISOString(),
    contracts: {
      AxionAgentRegistry: registryAddress,
      DecisionCommitmentLog: decisionLogAddress,
      EpochMemoryLog: epochLogAddress,
      AxionPolicyVault: policyVaultAddress,
    },
  };

  const dir = path.join(__dirname, "..", "deployments");
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, `${network.name}.json`);
  fs.writeFileSync(file, JSON.stringify(out, null, 2));
  console.log("\nDeployment written to", file);

  console.log("\nPaste these into web/.env.local:");
  console.log(`NEXT_PUBLIC_AGENT_REGISTRY_ADDRESS=${registryAddress}`);
  console.log(`NEXT_PUBLIC_DECISION_LOG_ADDRESS=${decisionLogAddress}`);
  console.log(`NEXT_PUBLIC_EPOCH_LOG_ADDRESS=${epochLogAddress}`);
  console.log(`NEXT_PUBLIC_POLICY_VAULT_ADDRESS=${policyVaultAddress}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
