import { ethers, network } from "hardhat";

import {
  getRouterConfig,
  getLINKTokenAddress
} from "../helpers/utils"

async function main() {
  const ethNativeTokenAddress = "0xfFf9976782d46CC05630D1f6eBAb18b2324d6B14";
  const ethLinkTokenAddress = "0x779877A7B0D9E8603169DdbD7836e478b4624789"; // Sepolia LINK address
  const ethUsdtTokenAddress = "0xa28C606a33AF8175F3bBf71d74796aDa360f4C49"; // Sepolia USDT address
  const ethPoolFactoryAddress = "0x1453298DaE6c7B60Ba41766F658404D967070759"
  const ethLinkPortAddress = "0xACe486949165FE8d2E088359AFB03C49f5Ec870A"; // Sepolia LinkPort address
  const ethNativePoolAddress = "0x23f726Ef0A41A4688D63E232d88f1EC5b947D3E0"
  const ethLinkPoolAddress = "0x0F17F74daCb8c535d518f4445449f72c0585413B"
  const ethUsdtPoolAddress = "0x015D59616616b23Aee7e1253d312Ced038a57832"; // Sepolia USDT Pool address
    // BSC Testnet WBNB address
  const bscNativeTokenAddress = "0xae13d989daC2f0dEbFf460aC112a837C89BAa7cd";
  const bscLinkTokenAddress = "0x84b9B910527Ad5C03A9Ca831909E21e236EA7b06"; // BSC Testnet LINK address
  const bscUsdtTokenAddress = "0x5016F623414b344a5C26ffDa4e61956c9a41Ca1e"; // BSC Testnet USDT address
  const bscPoolFactoryAddress = "0x0a4F7930bC015fB87c67A55abc5D0F031A35B405"
  const bscLinkPortAddress = "0x911e2008BDd299e99555dBdbb8f7ba1053C670F9"; // BSC Testnet LinkPort address
  const bscNativePoolAddress = "0x2c5841B545487d4F4C44d0b732141dd3D03d05fD"
  const bscLinkPoolAddress = "0x513E39C2bAb3bC4D6604241EB60A635EfDb8Ee63"
  const bscUsdtPoolAddress = "0x06c1DcEec34a8811Ad52F0fEfBcBA0991FdFB5B6"; // BSC Testnet USDT Pool address


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

  await sourceLinkPort.setPort(destCCIP.chainSelector, destLinkPortAddress)
  console.log(`Set destination port for ${sourceNetwork} to ${destNetwork} at ${destLinkPortAddress}`);
  await sourceLinkPort.setToken(sourceNativeTokenAddress, destCCIP.chainSelector, destNativeTokenAddress);
  console.log("Set native token for source network:", sourceNetwork, "to destination network:", destNetwork, "at", destNativeTokenAddress);
  await sourceLinkPort.setToken(sourceLinkTokenAddress, destCCIP.chainSelector, destLinkTokenAddress);
  console.log("Set LINK token for source network:", sourceNetwork, "to destination network:", destNetwork, "at", destLinkTokenAddress);
  await sourceLinkPort.setToken(sourceUsdtTokenAddress, destCCIP.chainSelector, destUsdtTokenAddress);
  console.log("Set USDT token for source network:", sourceNetwork, "to destination network:", destNetwork, "at", destUsdtTokenAddress);

}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});