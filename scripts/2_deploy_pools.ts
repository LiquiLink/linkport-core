import { ethers, network } from "hardhat";

import {
  getRouterConfig,
  getLINKTokenAddress
} from "../helpers/utils"
import { LinkPort__factory } from "../typechain-types";

async function main() {
  // Select WETH or WBNB based on network
  let nativeTokenAddress: string;
  let usdtTokenAddress: string;
  let linkTokenAddress: string;
  let poolFactoryAddress: string
  let linkPortAddress: string;
  let destNativeTokenAddress: string;
  if (network.name === "ethereumSepolia") {
    // Sepolia WETH address
    nativeTokenAddress = "0xfFf9976782d46CC05630D1f6eBAb18b2324d6B14";
    usdtTokenAddress = "0xa28C606a33AF8175F3bBf71d74796aDa360f4C49"; // Sepolia USDT address
    linkTokenAddress = "0x391e62e754caa820b606703d1920c34a35792dd6"; // Sepolia LINK address
    poolFactoryAddress = "0x22617E1566c4424534e7aDD6d4f45884Fbf8CE2C"
    linkPortAddress = "0xACe486949165FE8d2E088359AFB03C49f5Ec870A"; // Sepolia LinkPort address
    destNativeTokenAddress = "0xDC64753A100619a00aC950dA011c9eAB9B5aC870"

  } else if (network.name === "bnbChainTestnet") {
    // BSC Testnet WBNB address
    nativeTokenAddress = "0xae13d989daC2f0dEbFf460aC112a837C89BAa7cd";
    usdtTokenAddress = "0x5016F623414b344a5C26ffDa4e61956c9a41Ca1e"; // BSC Testnet USDT address
    poolFactoryAddress = "0x5AACDa3725D0efCd129561A7e9181eA6Ad7aEb05"
    linkTokenAddress = "0xf11935eb67fe7c505e93ed7751f8c59fc3199121"; // BSC Testnet LINK address
    linkPortAddress = "0x911e2008BDd299e99555dBdbb8f7ba1053C670F9"; // BSC Testnet LinkPort address
    destNativeTokenAddress = ""

  } else {
    throw new Error(`Unsupported network: ${network.name}`);
  }

  const [deployer] = await ethers.getSigners();
  const feeRate = 20;

  const PoolFactory = await ethers.getContractFactory("PoolFactory");
  const linkToken = getLINKTokenAddress(network.name)

  const poolFactory = await PoolFactory.attach(poolFactoryAddress);

  let tx;

  /*
  if (destNativeTokenAddress != "") {
    tx = await poolFactory.createPool(linkPortAddress, destNativeTokenAddress, feeRate); 
    await tx.wait();
  }
    */
  tx = await poolFactory.createPool(linkPortAddress, linkTokenAddress, feeRate); 
  await tx.wait();
  console.log("LINK LiquidityPool deployed to:", await poolFactory.getPool(linkTokenAddress));

  /*
  tx = await poolFactory.createPool(linkPortAddress, nativeTokenAddress, feeRate);
  await tx.wait();
  console.log("Native LiquidityPool deployed to:", await poolFactory.getPool(nativeTokenAddress));
  tx = await poolFactory.createPool(linkPortAddress, linkToken, feeRate);
  await tx.wait();
  console.log("LINK LiquidityPool deployed to:", await poolFactory.getPool(linkToken));
  tx = await poolFactory.createPool(linkPortAddress, usdtTokenAddress, feeRate);
  await tx.wait();
  console.log("USDT LiquidityPool deployed to:", await poolFactory.getPool(usdtTokenAddress));
  */
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});