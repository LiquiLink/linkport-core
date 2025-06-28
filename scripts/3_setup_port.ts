import { ethers, network } from "hardhat";

import {
  getRouterConfig,
  getLINKTokenAddress
} from "../helpers/utils"

async function main() {
  const ethNativeTokenAddress = "0xfFf9976782d46CC05630D1f6eBAb18b2324d6B14";
  const ethLinkTokenAddress = "0x391e62e754caa820b606703d1920c34a35792dd6"; // Sepolia LINK address
  const ethUsdtTokenAddress = "0xa28C606a33AF8175F3bBf71d74796aDa360f4C49"; // Sepolia USDT address
  const ethLinkPortAddress = "0xD03BAe9d0367ad9241243408D1137AfC92F2efe6"; // Sepolia LinkPort address
  const ethbnbTokenAddress = "0xDC64753A100619a00aC950dA011c9eAB9B5aC870"
  const ethNativePoolAddress = "0x3812A2D9925bA5FD8915d8B0b8cc6A00fe0ed808"
    // BSC Testnet WBNB address
  const bscNativeTokenAddress = "0xae13d989daC2f0dEbFf460aC112a837C89BAa7cd";
  const bscLinkTokenAddress = "0xf11935eb67fe7c505e93ed7751f8c59fc3199121"; // BSC Testnet LINK address
  const bscUsdtTokenAddress = "0x5016F623414b344a5C26ffDa4e61956c9a41Ca1e"; // BSC Testnet USDT address
  const bscLinkPortAddress = "0xDC64753A100619a00aC950dA011c9eAB9B5aC870"; // BSC Testnet LinkPort address


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
    destNativePoolAddress = ethNativePoolAddress;
    sourceNetwork = "bnbChainTestnet";
    destNetwork = "ethereumSepolia";
  } else {
    throw new Error(`Unsupported network: ${network.name}`);
  }

  const LinkPortFactory = await ethers.getContractFactory("LinkPort");
  const destCCIP = getRouterConfig(destNetwork)

  const sourceLinkPort = await LinkPortFactory.attach(sourceLinkPortAddress);

  await sourceLinkPort.setPort(destCCIP.chainSelector, destLinkPortAddress)
  console.log(`Set destination port for ${sourceNetwork} to ${destNetwork} at ${destLinkPortAddress}`);
  await sourceLinkPort.setToken(ethLinkTokenAddress, destCCIP.chainSelector, bscLinkTokenAddress);
  await sourceLinkPort.setToken(bscLinkTokenAddress, destCCIP.chainSelector, ethLinkTokenAddress);
  await sourceLinkPort.setToken(ethUsdtTokenAddress, destCCIP.chainSelector, bscUsdtTokenAddress);
  await sourceLinkPort.setToken(bscUsdtTokenAddress, destCCIP.chainSelector, ethUsdtTokenAddress);
  await sourceLinkPort.setToken(ethbnbTokenAddress, destCCIP.chainSelector, bscNativeTokenAddress);
  await sourceLinkPort.setToken(bscNativeTokenAddress, destCCIP.chainSelector, ethbnbTokenAddress);

}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});