import { expect } from "chai";
import { ethers } from "hardhat";
import { time } from "@nomicfoundation/hardhat-network-helpers";

const USDC = (n: number) => BigInt(Math.round(n * 1e6));

describe("MockUSDC + AxionYieldVault (real on-chain execution layer)", () => {
  async function deployFixture() {
    const [deployer, user] = await ethers.getSigners();

    const USDCFactory = await ethers.getContractFactory("MockUSDC");
    const usdc = await USDCFactory.deploy();
    await usdc.waitForDeployment();

    const VaultFactory = await ethers.getContractFactory("AxionYieldVault");
    // Balanced Safe Yield: 5.60% APY, 0.48% entry fee, safe.
    const vault = await VaultFactory.deploy(
      await usdc.getAddress(),
      "Balanced Safe Yield",
      "safe",
      560,
      48
    );
    await vault.waitForDeployment();

    // Fund the vault reward reserve and give the user a balance.
    await usdc.mint(await vault.getAddress(), USDC(100_000));
    await usdc.mint(user.address, USDC(1_000));

    return { deployer, user, usdc, vault };
  }

  it("mints, faucets and enforces the faucet cap", async () => {
    const { usdc, user } = await deployFixture();
    expect(await usdc.balanceOf(user.address)).to.equal(USDC(1_000));

    await usdc.connect(user).faucet(USDC(5_000));
    expect(await usdc.balanceOf(user.address)).to.equal(USDC(6_000));

    await expect(usdc.connect(user).faucet(USDC(50_000))).to.be.revertedWith(
      "MockUSDC: over faucet cap"
    );
  });

  it("exposes realised terms via quote()", async () => {
    const { vault } = await deployFixture();
    const [apy, fee, tag] = await vault.quote();
    expect(apy).to.equal(560n);
    expect(fee).to.equal(48n);
    expect(tag).to.equal("safe");
  });

  it("takes a real entry fee on deposit and credits net principal", async () => {
    const { usdc, vault, user } = await deployFixture();
    const vaultAddr = await vault.getAddress();

    await usdc.connect(user).approve(vaultAddr, USDC(100));
    await expect(vault.connect(user).deposit(USDC(100))).to.emit(vault, "Deposited");

    // 0.48% of 100 = 0.48 fee -> 99.52 credited.
    const [principal, , accrued] = await vault.positionOf(user.address);
    expect(principal).to.equal(USDC(99.52));
    expect(accrued).to.equal(0n); // no time elapsed yet
    expect(await usdc.balanceOf(user.address)).to.equal(USDC(900));
  });

  it("accrues real linear yield over time and pays out on withdraw", async () => {
    const { usdc, vault, user } = await deployFixture();
    const vaultAddr = await vault.getAddress();

    await usdc.connect(user).approve(vaultAddr, USDC(100));
    await vault.connect(user).deposit(USDC(100)); // 99.52 principal

    // Advance one full year.
    await time.increase(365 * 24 * 60 * 60);

    // Expected yield ≈ 99.52 * 5.60% = 5.57312 USDC.
    const accrued = await vault.accruedYield(user.address);
    expect(accrued).to.equal(USDC(99.52) * 560n / 10_000n);

    const balBefore = await usdc.balanceOf(user.address);
    await expect(vault.connect(user).withdraw()).to.emit(vault, "Withdrawn");
    const balAfter = await usdc.balanceOf(user.address);

    // Got principal + yield back.
    expect(balAfter - balBefore).to.equal(USDC(99.52) + (USDC(99.52) * 560n) / 10_000n);

    // Position cleared.
    const [principal, , accruedAfter] = await vault.positionOf(user.address);
    expect(principal).to.equal(0n);
    expect(accruedAfter).to.equal(0n);
  });

  it("reverts withdraw with nothing deposited", async () => {
    const { vault, user } = await deployFixture();
    await expect(vault.connect(user).withdraw()).to.be.revertedWith(
      "Vault: nothing to withdraw"
    );
  });

  it("accepts reward funding top-ups", async () => {
    const { usdc, vault, deployer } = await deployFixture();
    const vaultAddr = await vault.getAddress();
    await usdc.mint(deployer.address, USDC(1_000));
    await usdc.approve(vaultAddr, USDC(1_000));
    await expect(vault.fundRewards(USDC(1_000))).to.emit(vault, "RewardsFunded");
  });
});
