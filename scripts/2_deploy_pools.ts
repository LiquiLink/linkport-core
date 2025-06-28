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
  let poolFactoryAddress: string
  let linkPortAddress: string;
  if (network.name === "ethereumSepolia") {
    // Sepolia WETH address
    nativeTokenAddress = "0xfFf9976782d46CC05630D1f6eBAb18b2324d6B14";
    usdtTokenAddress = "0xa28C606a33AF8175F3bBf71d74796aDa360f4C49"; // Sepolia USDT address
    poolFactoryAddress = "0x612A3765056Bf76Dfa813373d931C2A477992639"
    linkPortAddress = "0x110B273c4DB995188602492599a583B9eAfD74d0"; // Sepolia LinkPort address

  } else if (network.name === "bnbChainTestnet") {
    // BSC Testnet WBNB address
    nativeTokenAddress = "0xae13d989daC2f0dEbFf460aC112a837C89BAa7cd";
    usdtTokenAddress = "0x5016F623414b344a5C26ffDa4e61956c9a41Ca1e"; // BSC Testnet USDT address
    poolFactoryAddress = "0x468995887a7FeE344c38B496bA6b8E439091cB5b"
    linkPortAddress = "0x24F81DA0aBBD2a88605E4B140880647F26178744"; // BSC Testnet LinkPort address

  } else {
    throw new Error(`Unsupported network: ${network.name}`);
  }

  const [deployer] = await ethers.getSigners();
  const feeRate = 20;

  const PoolFactory = await ethers.getContractFactory("PoolFactory");
  const linkToken = getLINKTokenAddress(network.name)

  const poolFactory = await PoolFactory.attach(poolFactoryAddress);

  let tx;

  tx = await poolFactory.createPool(linkPortAddress, nativeTokenAddress, feeRate);
  await tx.wait();
  console.log("Native LiquidityPool deployed to:", await poolFactory.getPool(nativeTokenAddress));
  tx = await poolFactory.createPool(linkPortAddress, linkToken, feeRate);
  await tx.wait();
  console.log("LINK LiquidityPool deployed to:", await poolFactory.getPool(linkToken));
  tx = await poolFactory.createPool(linkPortAddress, usdtTokenAddress, feeRate);
  await tx.wait();
  console.log("USDT LiquidityPool deployed to:", await poolFactory.getPool(usdtTokenAddress));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});