import hre  from "hardhat";
import { ethers } from "hardhat";

import {
  getRouterConfig,
  getLINKTokenAddress
} from "../helpers/utils"

async function main() {

  const Faucet = await ethers.getContractFactory("Faucet");

  const faucet = await Faucet.deploy("0xa28C606a33AF8175F3bBf71d74796aDa360f4C49", ethers.parseEther("100"));


}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});