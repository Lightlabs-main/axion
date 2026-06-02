import { ethers, network } from "hardhat";
import * as fs from "fs";
import * as path from "path";

const USDC = (n: number) => BigInt(Math.round(n * 1e6));

async function main() {
  const [deployer] = await ethers.getSigners();
  const bal = await ethers.provider.getBalance(deployer.address);
  console.log("Deploying Axion with account:", deployer.address);
  console.log("Network:", network.name);
  console.log("Balance:", ethers.formatEther(bal), "MNT\n");

  // --- Core Axion identity / commitment / memory contracts ---
  const Registry = await ethers.getContractFactory("AxionAgentRegistry");
  const registry = await Registry.deploy();
  await registry.waitForDeployment();
  const registryAddress = await registry.getAddress();
  console.log("AxionAgentRegistry:   ", registryAddress);

  const DecisionLog = await ethers.getContractFactory("DecisionCommitmentLog");
  const decisionLog = await DecisionLog.deploy();
  await decisionLog.waitForDeployment();
  const decisionLogAddress = await decisionLog.getAddress();
  console.log("DecisionCommitmentLog:", decisionLogAddress);

  const EpochLog = await ethers.getContractFactory("EpochMemoryLog");
  const epochLog = await EpochLog.deploy();
  await epochLog.waitForDeployment();
  const epochLogAddress = await epochLog.getAddress();
  console.log("EpochMemoryLog:       ", epochLogAddress);

  const PolicyVault = await ethers.getContractFactory("AxionPolicyVault");
  const policyVault = await PolicyVault.deploy();
  await policyVault.waitForDeployment();
  const policyVaultAddress = await policyVault.getAddress();
  console.log("AxionPolicyVault:     ", policyVaultAddress);

  // --- Real execution layer: test USDC + yield vaults ---
  const USDCFactory = await ethers.getContractFactory("MockUSDC");
  const usdc = await USDCFactory.deploy();
  await usdc.waitForDeployment();
  const usdcAddress = await usdc.getAddress();
  console.log("MockUSDC (aUSDC):     ", usdcAddress);

  const VaultFactory = await ethers.getContractFactory("AxionYieldVault");

  // Branch B target — Balanced Safe Yield: 5.60% APY, 0.48% entry fee.
  const balancedVault = await VaultFactory.deploy(
    usdcAddress,
    "Balanced Safe Yield",
    "safe",
    560,
    48
  );
  await balancedVault.waitForDeployment();
  const balancedAddress = await balancedVault.getAddress();
  console.log("Vault · Balanced:     ", balancedAddress);

  // Branch A target — High APY Pool: 12.00% APY, 1.80% entry fee, unsafe.
  const highApyVault = await VaultFactory.deploy(
    usdcAddress,
    "High APY Pool",
    "unsafe",
    1200,
    180
  );
  await highApyVault.waitForDeployment();
  const highApyAddress = await highApyVault.getAddress();
  console.log("Vault · High APY:     ", highApyAddress);

  // --- Seed reward reserves + deployer test balance ---
  console.log("\nSeeding reward reserves and deployer balance...");
  await (await usdc.mint(balancedAddress, USDC(100_000))).wait();
  await (await usdc.mint(highApyAddress, USDC(100_000))).wait();
  await (await usdc.mint(deployer.address, USDC(10_000))).wait();
  console.log("Minted 100k aUSDC to each vault and 10k to deployer.");

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
      MockUSDC: usdcAddress,
      BalancedVault: balancedAddress,
      HighApyVault: highApyAddress,
    },
  };

  const dir = path.join(__dirname, "..", "deployments");
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, `${network.name}.json`);
  fs.writeFileSync(file, JSON.stringify(out, null, 2));
  console.log("\nDeployment written to", file);

  const envLines = [
    `NEXT_PUBLIC_CHAIN_ID=${out.chainId}`,
    `NEXT_PUBLIC_AGENT_REGISTRY_ADDRESS=${registryAddress}`,
    `NEXT_PUBLIC_DECISION_LOG_ADDRESS=${decisionLogAddress}`,
    `NEXT_PUBLIC_EPOCH_LOG_ADDRESS=${epochLogAddress}`,
    `NEXT_PUBLIC_POLICY_VAULT_ADDRESS=${policyVaultAddress}`,
    `NEXT_PUBLIC_USDC_ADDRESS=${usdcAddress}`,
    `NEXT_PUBLIC_BALANCED_VAULT_ADDRESS=${balancedAddress}`,
    `NEXT_PUBLIC_HIGH_APY_VAULT_ADDRESS=${highApyAddress}`,
  ];
  console.log("\n=== Paste these into web/.env.local ===\n" + envLines.join("\n"));

  // Also write a ready-to-use env file next to the web app for convenience.
  const webEnvPath = path.join(__dirname, "..", "..", "web", ".env.local");
  try {
    fs.writeFileSync(webEnvPath, envLines.join("\n") + "\n");
    console.log("\nAlso wrote", webEnvPath);
  } catch {
    console.log("\n(Could not auto-write web/.env.local — copy the lines above.)");
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
