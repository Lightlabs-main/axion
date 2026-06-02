import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import * as dotenv from "dotenv";

dotenv.config();

const PRIVATE_KEY = process.env.PRIVATE_KEY ?? "";
// Mantle Sepolia testnet RPC. Override via .env (MANTLE_RPC_URL) if needed.
const MANTLE_RPC_URL =
  process.env.MANTLE_RPC_URL ?? "https://rpc.sepolia.mantle.xyz";

const config: HardhatUserConfig = {
  solidity: {
    version: "0.8.24",
    settings: {
      optimizer: { enabled: true, runs: 200 },
    },
  },
  networks: {
    hardhat: {},
    localhost: {
      url: "http://127.0.0.1:8545",
    },
    // Mantle Sepolia testnet (chainId 5003)
    mantleSepolia: {
      url: MANTLE_RPC_URL,
      chainId: 5003,
      accounts: PRIVATE_KEY ? [PRIVATE_KEY] : [],
    },
    // Mantle mainnet (chainId 5000) — left configured for completeness.
    mantle: {
      url: process.env.MANTLE_MAINNET_RPC_URL ?? "https://rpc.mantle.xyz",
      chainId: 5000,
      accounts: PRIVATE_KEY ? [PRIVATE_KEY] : [],
    },
  },
};

export default config;
