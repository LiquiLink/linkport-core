import { ethers } from "hardhat";

async function main() {
  // 1. Deploy TToken
  const TToken = await ethers.getContractFactory("TToken");
  const tToken = await TToken.deploy("Test Token", "TTK");
  await tToken.deployed();
  console.log("TToken deployed to:", tToken.address);

  // 2. Deploy PoolFactory
  const PoolFactory = await ethers.getContractFactory("PoolFactory");
  const poolFactory = await PoolFactory.deploy();
  await poolFactory.deployed();
  console.log("PoolFactory deployed to:", poolFactory.address);

  // 3. Deploy a LiquidityPool via PoolFactory
  // For demonstration, use deployer's address as port, tToken as asset, and 50 as feeRate
  const [deployer] = await ethers.getSigners();
  const feeRate = 50;
  const tx = await poolFactory.createPool(deployer.address, tToken.address, feeRate);
  const receipt = await tx.wait();
  const poolAddress = await poolFactory.getPool(tToken.address);
  console.log("LiquidityPool deployed to:", poolAddress);

  // 4. Deploy LinkPort
  // For demonstration, use poolFactory address, a dummy ccipRouter address, and a dummy targetChainSelector
  const dummyCCIPRouter = ethers.constants.AddressZero;
  const dummyTargetChainSelector = 0;
  const LinkPort = await ethers.getContractFactory("LinkPort");
  const linkPort = await LinkPort.deploy(poolFactory.address, dummyCCIPRouter, dummyTargetChainSelector);
  await linkPort.deployed();
  console.log("LinkPort deployed to:", linkPort.address);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});