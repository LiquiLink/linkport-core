import { ethers, network } from "hardhat";

import {
  getRouterConfig,
  getLINKTokenAddress
} from "../helpers/utils"

async function main() {
  const ethNativeTokenAddress = "0xfFf9976782d46CC05630D1f6eBAb18b2324d6B14";
  const ethLinkTokenAddress = "0x391e62e754caa820b606703d1920c34a35792dd6"; // Sepolia LINK address
  const ethUsdtTokenAddress = "0xa28C606a33AF8175F3bBf71d74796aDa360f4C49"; // Sepolia USDT address
  const ethLinkPortAddress = "0x110B273c4DB995188602492599a583B9eAfD74d0"; // Sepolia LinkPort address
  const ethbnbTokenAddress = "0xDC64753A100619a00aC950dA011c9eAB9B5aC870"
  const ethNativePoolAddress = "0x3812A2D9925bA5FD8915d8B0b8cc6A00fe0ed808"
  const ethLinkPoolAddress = "0xAc285c231b766BbE0b7964125fb01f808775CB0a"
  const ethUsdtPoolAddress = "0x33e0Eee584352f61490F91951B162E38d0a6EeD7"; // Sepolia USDT Pool address
    // BSC Testnet WBNB address
  const bscNativeTokenAddress = "0xae13d989daC2f0dEbFf460aC112a837C89BAa7cd";
  const bscLinkTokenAddress = "0xf11935eb67fe7c505e93ed7751f8c59fc3199121"; // BSC Testnet LINK address
  const bscUsdtTokenAddress = "0x5016F623414b344a5C26ffDa4e61956c9a41Ca1e"; // BSC Testnet USDT address
  const bscLinkPortAddress = "0x24F81DA0aBBD2a88605E4B140880647F26178744"; // BSC Testnet LinkPort address
  const bscNativePoolAddress = "0x6a2C375d743382eB7ee79A8cEBA8aB8dA3e9d99a"
  const bscLinkPoolAddress = "0x3aA26101A8b4Dc77A0467a5B9aF0702d57621D16"
  const bscUsdtPoolAddress = "0x8dd2DeDd22C63667b82575E9E59DC43612CE1758"; // BSC Testnet USDT Pool address


  let sourceLinkPortAddress : string
  let destLinkPortAddress : string
  let sourceLinkTokenAddress : string
  let destLinkTokenAddress : string
  let sourceNativeTokenAddress : string
  let destNativeTokenAddress : string
  let sourceUsdtTokenAddress : string
  let destUsdtTokenAddress : string
  let sourceNativePoolAddress : string
  let destNativePoolAddress : string
  let sourceLinkPoolAddress : string
  let destLinkPoolAddress : string
  let sourceUsdtPoolAddress : string   
  let destUsdtPoolAddress : string
  let sourceNetwork;
  let destNetwork;
  if (network.name === "ethereumSepolia") {
    sourceLinkPortAddress = ethLinkPortAddress;
    destLinkPortAddress = bscLinkPortAddress;
    sourceLinkTokenAddress = ethLinkTokenAddress;
    destLinkTokenAddress = bscLinkTokenAddress;
    sourceNativeTokenAddress = ethNativeTokenAddress;
    destNativeTokenAddress = bscNativeTokenAddress;
    sourceUsdtTokenAddress = ethUsdtTokenAddress;
    destUsdtTokenAddress = bscUsdtTokenAddress;
    sourceNativePoolAddress = ethNativePoolAddress;
    destNativePoolAddress = bscNativePoolAddress;
    sourceLinkPoolAddress = ethLinkPoolAddress;
    destLinkPoolAddress = bscLinkPoolAddress;
    sourceUsdtPoolAddress = ethUsdtPoolAddress;
    destUsdtPoolAddress = bscUsdtPoolAddress;
    sourceNetwork = "ethereumSepolia";
    destNetwork = "bnbChainTestnet";

  } else if (network.name === "bnbChainTestnet") {
    sourceLinkPortAddress = bscLinkPortAddress;
    destLinkPortAddress = ethLinkPortAddress;
    sourceLinkTokenAddress = bscLinkTokenAddress;
    destLinkTokenAddress = ethLinkTokenAddress;
    sourceNativeTokenAddress = bscNativeTokenAddress;
    destNativeTokenAddress = ethNativeTokenAddress;
    sourceUsdtTokenAddress = bscUsdtTokenAddress;
    destUsdtTokenAddress = ethUsdtTokenAddress;
    sourceNativePoolAddress = bscNativePoolAddress;
    destNativePoolAddress = ethNativePoolAddress;
    sourceLinkPoolAddress = bscLinkPoolAddress;
    destLinkPoolAddress = ethLinkPoolAddress;
    sourceUsdtPoolAddress = bscUsdtPoolAddress;
    destUsdtPoolAddress = ethUsdtPoolAddress;
    sourceNetwork = "bnbChainTestnet";
    destNetwork = "ethereumSepolia";
  } else {
    throw new Error(`Unsupported network: ${network.name}`);
  }

  const LinkPortFactory = await ethers.getContractFactory("LinkPort");
  const sourceCCIP = getRouterConfig(sourceNetwork)
  const destCCIP = getRouterConfig(destNetwork)

  const sourceLinkPort = await LinkPortFactory.attach(sourceLinkPortAddress);

  /*
  await sourceLinkPort.setPort(destCCIP.chainSelector, destLinkPortAddress)
  console.log(`Set destination port for ${sourceNetwork} to ${destNetwork} at ${destLinkPortAddress}`);
  await sourceLinkPort.setToken(ethbnbPoolAddress, destCCIP.chainSelector, destNativePoolAddress);
  console.log("Set native token for source network:", sourceNetwork, "to destination network:", destNetwork, "at", destNativeTokenAddress);
  await sourceLinkPort.setToken(sourceLinkTokenAddress, destCCIP.chainSelector, destLinkTokenAddress);
  console.log("Set LINK token for source network:", sourceNetwork, "to destination network:", destNetwork, "at", destLinkTokenAddress);
  await sourceLinkPort.setToken(sourceUsdtTokenAddress, destCCIP.chainSelector, destUsdtTokenAddress);
  console.log("Set USDT token for source network:", sourceNetwork, "to destination network:", destNetwork, "at", destUsdtTokenAddress);
  */

  //await sourceLinkPort.setToken(ethbnbPoolAddress, destCCIP.chainSelector, destNativeTokenAddress);
  await sourceLinkPort.setToken(bscNativeTokenAddress, destCCIP.chainSelector, ethbnbTokenAddress);
  await sourceLinkPort.setToken(bscLinkPoolAddress, destCCIP.chainSelector, ethLinkTokenAddress);
  await sourceLinkPort.setToken(bscUsdtTokenAddress, destCCIP.chainSelector, ethUsdtTokenAddress);

}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});