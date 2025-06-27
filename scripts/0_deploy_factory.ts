import hre  from "hardhat";
import { ethers } from "hardhat";

import {
  getRouterConfig,
  getLINKTokenAddress
} from "../helpers/utils"

async function main() {

  const PoolFactory = await ethers.getContractFactory("PoolFactory");


  const poolFactory = await PoolFactory.deploy()

  console.log("PoolFactory deployed to:", poolFactory.target);

}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});