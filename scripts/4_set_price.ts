import { ethers, network } from "hardhat";

import {
  getRouterConfig,
  getLINKTokenAddress
} from "../helpers/utils"

async function main() {
  const ethNativeTokenAddress = "0xfFf9976782d46CC05630D1f6eBAb18b2324d6B14";
  const ethLinkTokenAddress = "0x391e62e754caa820b606703d1920c34a35792dd6"; // Sepolia LINK address
  const ethUsdtTokenAddress = "0xa28C606a33AF8175F3bBf71d74796aDa360f4C49"; // Sepolia USDT address
  const ethbnbTokenAddress = "0xDC64753A100619a00aC950dA011c9eAB9B5aC870"; // Sepolia WBNB address
  const ethLinkPortAddress = "0xD03BAe9d0367ad9241243408D1137AfC92F2efe6"; // Sepolia LinkPort address
    // BSC Testnet WBNB address
  const bscNativeTokenAddress = "0xae13d989daC2f0dEbFf460aC112a837C89BAa7cd";
  const bscLinkTokenAddress = "0xf11935eb67fe7c505e93ed7751f8c59fc3199121"; // BSC Testnet LINK address
  const bscUsdtTokenAddress = "0x5016F623414b344a5C26ffDa4e61956c9a41Ca1e"; // BSC Testnet USDT address
  const bscLinkPortAddress = "0xDC64753A100619a00aC950dA011c9eAB9B5aC870"; // BSC Testnet LinkPort address


  let sourceLinkPortAddress : string
  let sourceNetwork;
  if (network.name === "ethereumSepolia") {
    sourceLinkPortAddress = ethLinkPortAddress;
    sourceNetwork = "ethereumSepolia";

  } else if (network.name === "bnbChainTestnet") {
    sourceLinkPortAddress = bscLinkPortAddress;
    sourceNetwork = "bnbChainTestnet";
  } else {
    throw new Error(`Unsupported network: ${network.name}`);
  }

  const LinkPortFactory = await ethers.getContractFactory("LinkPort");

  const sourceLinkPort = await LinkPortFactory.attach(sourceLinkPortAddress);

  await sourceLinkPort.setTokenPrice(ethLinkTokenAddress, 15)
  await sourceLinkPort.setTokenPrice(ethUsdtTokenAddress, 1)
  await sourceLinkPort.setTokenPrice(ethNativeTokenAddress, 2500)
  await sourceLinkPort.setTokenPrice(ethbnbTokenAddress, 660)
  await sourceLinkPort.setTokenPrice(bscLinkTokenAddress, 15)
  await sourceLinkPort.setTokenPrice(bscUsdtTokenAddress, 1)
  await sourceLinkPort.setTokenPrice(bscNativeTokenAddress, 660)
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});