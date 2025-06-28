import hre  from "hardhat";
import { ethers } from "hardhat";

import {
  getRouterConfig,
  getLINKTokenAddress
} from "../helpers/utils"

async function main() {
  let poolFactoryAddress: string
  if (hre.network.name === "ethereumSepolia") {
    poolFactoryAddress = process.env.SEPOLIA_FACTORY_ADDRESS || "0xd2a3362123b35E3A59C68B5719A0C8bfBC28d50e"
  } else if (hre.network.name === "bnbChainTestnet") {
    poolFactoryAddress = process.env.BNBTESTNET_FACTORY_ADDRESS || "0x7F4EeEa9D8A1B3d1da3b329a150025Fb19d982E2"
  } else {
    throw new Error(`Unsupported network: ${hre.network.name}`);
  }

  const LinkPortFactory = await ethers.getContractFactory("LinkPort");
  const ccipRouter = getRouterConfig(hre.network.name).address;
  const linkToken = getLINKTokenAddress(hre.network.name)
  const [deployer] = await ethers.getSigners();

 // console.log("Deploying LinkPort with the account:", deployer)


  const LinkPort = await LinkPortFactory.deploy(poolFactoryAddress, ccipRouter, linkToken);

  console.log("LinkPort deployed to:", LinkPort.target);

}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});