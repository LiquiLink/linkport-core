import hre  from "hardhat";
import { ethers } from "hardhat";

import {
  getRouterConfig,
  getLINKTokenAddress
} from "../helpers/utils"

async function main() {
  let poolFactoryAddress: string
  if (hre.network.name === "ethereumSepolia") {
    poolFactoryAddress = "0x612A3765056Bf76Dfa813373d931C2A477992639"
  } else if (hre.network.name === "bnbChainTestnet") {
    poolFactoryAddress = "0x468995887a7FeE344c38B496bA6b8E439091cB5b"
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