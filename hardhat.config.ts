import { HardhatUserConfig } from "hardhat/config";
import "@nomiclabs/hardhat-waffle";
import "@nomiclabs/hardhat-ethers";
import "dotenv/config";

const config: HardhatUserConfig = {
  solidity: {
    version: "0.8.20",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
    },
  },
  networks: {
    sepolia: {
      url: process.env.LINKPORT_SEPOLIA_URL || "",
      accounts: process.env.LINKPORT_PRIVATE_KEY !== undefined ? [process.env.LINKPORT_PRIVATE_KEY] : [],
    },
    mainnet: {
      url: process.env.LINKPORT_MAINNET_URL || "",
      accounts: process.env.LINKPORT_PRIVATE_KEY !== undefined ? [process.env.LINKPORT_PRIVATE_KEY] : [],
    },
  },
};

export default config;
