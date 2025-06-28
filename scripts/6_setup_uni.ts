import { ethers, network } from "hardhat";

import {
  getRouterConfig,
  getLINKTokenAddress
} from "../helpers/utils"

async function main() {
  const ethNativeTokenAddress = "0xfFf9976782d46CC05630D1f6eBAb18b2324d6B14";
  const ethLinkTokenAddress = "0x779877A7B0D9E8603169DdbD7836e478b4624789"; // Sepolia LINK address
  const ethUsdtTokenAddress = "0xa28C606a33AF8175F3bBf71d74796aDa360f4C49"; // Sepolia USDT address
  const ethLinkPortAddress = "0xD03BAe9d0367ad9241243408D1137AfC92F2efe6"; // Sepolia LinkPort address
  const ethUniswapRouterAddress = "0x1675325a59017823c9417DE46EF55Bbe4ca3136c"; // Uniswap V2 Router address
    // BSC Testnet WBNB address
  const bscNativeTokenAddress = "0xae13d989daC2f0dEbFf460aC112a837C89BAa7cd";
  const bscLinkTokenAddress = "0x84b9B910527Ad5C03A9Ca831909E21e236EA7b06"; // BSC Testnet LINK address
  const bscUsdtTokenAddress = "0x5016F623414b344a5C26ffDa4e61956c9a41Ca1e"; // BSC Testnet USDT address
  const bscLinkPortAddress = "0x24F81DA0aBBD2a88605E4B140880647F26178744"; // BSC Testnet LinkPort address
  const bscUniswapRouterAddress = "0xD99D1c33F9fC3444f8101754aBC46c52416550D1"; // PancakeSwap Router address


  let sourceLinkPortAddress : string
  let sourceNetwork;
  let swapRouterAddress: string;
  if (network.name === "ethereumSepolia") {
    sourceLinkPortAddress = ethLinkPortAddress;
    sourceNetwork = "ethereumSepolia";
    swapRouterAddress = ethUniswapRouterAddress;

  } else if (network.name === "bnbChainTestnet") {
    sourceLinkPortAddress = bscLinkPortAddress;
    sourceNetwork = "bnbChainTestnet";
    swapRouterAddress = bscUniswapRouterAddress;
  } else {
    throw new Error(`Unsupported network: ${network.name}`);
  }

  const LinkPortFactory = await ethers.getContractFactory("LinkPort");

  const sourceLinkPort = await LinkPortFactory.attach(sourceLinkPortAddress);

  const router = await sourceLinkPort.uniswapV2Router()
  console.log("Current UniswapV2 Router Address:", router);
  await sourceLinkPort.setUniswapV2Router(swapRouterAddress);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});