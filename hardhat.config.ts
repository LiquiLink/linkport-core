import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import "dotenv/config";

const config: HardhatUserConfig = {
  solidity: {
    version: "0.8.20",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
      viaIR: true,
    },
  },
  networks: {
    ethereumSepolia: {
      url: process.env.ETHEREUM_SEPOLIA_RPC_URL || "",
      accounts: process.env.LINKPORT_PRIVATE_KEY !== undefined ? [process.env.LINKPORT_PRIVATE_KEY] : [],
    },
    arbitrumSepolia: {
      url: process.env.ARBITRUM_SEPOLIA_RPC_URL|| "",
      accounts: process.env.LINKPORT_PRIVATE_KEY !== undefined ? [process.env.LINKPORT_PRIVATE_KEY] : [],
    },
    bnbtestnet: {
      url: process.env.LINKPORT_BNBTESTNET_URL || "",
      accounts: process.env.LINKPORT_PRIVATE_KEY !== undefined ? [process.env.LINKPORT_PRIVATE_KEY] : [],
    },
  },
  mocha: {
    timeout: 1800000,
  }
};

export default config;
