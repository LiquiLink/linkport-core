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
    poolFactoryAddress = process.env.SEPOLIA_FACTORY_ADDRESS || "0xd2a3362123b35E3A59C68B5719A0C8bfBC28d50e"
    linkPortAddress = process.env.SEPOLIA_LINKPORT_ADDRESS || "0xD03BAe9d0367ad9241243408D1137AfC92F2efe6"; // Sepolia LinkPort address
    destNativeTokenAddress = "0xDC64753A100619a00aC950dA011c9eAB9B5aC870"

  } else if (network.name === "bnbChainTestnet") {
    // BSC Testnet WBNB address
    nativeTokenAddress = "0xae13d989daC2f0dEbFf460aC112a837C89BAa7cd";
    usdtTokenAddress = "0x5016F623414b344a5C26ffDa4e61956c9a41Ca1e"; // BSC Testnet USDT address
    linkTokenAddress = "0xf11935eb67fe7c505e93ed7751f8c59fc3199121"; // BSC Testnet LINK address
    poolFactoryAddress = process.env.BNBTESTNET_FACTORY_ADDRESS || "0x7F4EeEa9D8A1B3d1da3b329a150025Fb19d982E2"
    linkPortAddress = process.env.BNBTESTNET_LINKPORT_ADDRESS || "0xDC64753A100619a00aC950dA011c9eAB9B5aC870"; // BSC Testnet LinkPort address
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

  if (destNativeTokenAddress != "") {
    //tx = await poolFactory.createPool(linkPortAddress, destNativeTokenAddress, feeRate); 
    //await tx.wait();
    console.log("DestNativeToken LiquidityPool deployed to:", await poolFactory.getPool(destNativeTokenAddress));
  }
  tx = await poolFactory.createPool(linkPortAddress, linkTokenAddress, feeRate); 
  await tx.wait();
  console.log("LINK LiquidityPool deployed to:", await poolFactory.getPool(linkTokenAddress));
  tx = await poolFactory.createPool(linkPortAddress, nativeTokenAddress, feeRate);
  await tx.wait();
  console.log("NativeToken LiquidityPool deployed to:", await poolFactory.getPool(nativeTokenAddress));
  tx = await poolFactory.createPool(linkPortAddress, usdtTokenAddress, feeRate);
  await tx.wait();
  console.log("USDT LiquidityPool deployed to:", await poolFactory.getPool(usdtTokenAddress));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});