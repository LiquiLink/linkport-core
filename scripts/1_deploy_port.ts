import hre  from "hardhat";
import { ethers } from "hardhat";

import {
  getRouterConfig,
  getLINKTokenAddress
} from "../helpers/utils"

async function main() {
  let poolFactoryAddress: string
  if (hre.network.name === "ethereumSepolia") {
    poolFactoryAddress = "0x22617E1566c4424534e7aDD6d4f45884Fbf8CE2C"
  } else if (hre.network.name === "bnbChainTestnet") {
    poolFactoryAddress = "0x5AACDa3725D0efCd129561A7e9181eA6Ad7aEb05"
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