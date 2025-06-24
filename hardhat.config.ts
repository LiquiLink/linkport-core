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
};

export default config;
