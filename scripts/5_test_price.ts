import { ethers, network } from "hardhat";

import {
  getRouterConfig,
  getLINKTokenAddress
} from "../helpers/utils"
import { linkPortSol } from "../typechain-types/contracts";

async function main() {
  const ethNativeTokenAddress = "0xfFf9976782d46CC05630D1f6eBAb18b2324d6B14";
  const ethLinkTokenAddress = "0x391e62e754caa820b606703d1920c34a35792dd6"; // Sepolia LINK address
  const ethUsdtTokenAddress = "0xa28C606a33AF8175F3bBf71d74796aDa360f4C49"; // Sepolia USDT address
  const ethPoolFactoryAddress = "0x1453298DaE6c7B60Ba41766F658404D967070759"
  const ethLinkPortAddress = process.env.SEPOLIA_LINKPORT_ADDRESS ||  "0xACe486949165FE8d2E088359AFB03C49f5Ec870A"; // Sepolia LinkPort address
  const ethNativePoolAddress = "0x23f726Ef0A41A4688D63E232d88f1EC5b947D3E0"
  const ethLinkPoolAddress = "0x0F17F74daCb8c535d518f4445449f72c0585413B"
  const ethUsdtPoolAddress = "0x015D59616616b23Aee7e1253d312Ced038a57832"; // Sepolia USDT Pool address
    // BSC Testnet WBNB address
  const bscNativeTokenAddress = "0xae13d989daC2f0dEbFf460aC112a837C89BAa7cd";
  const bscLinkTokenAddress = "0xf11935eb67fe7c505e93ed7751f8c59fc3199121"; // BSC Testnet LINK address
  const bscUsdtTokenAddress = "0x5016F623414b344a5C26ffDa4e61956c9a41Ca1e"; // BSC Testnet USDT address
  const bscPoolFactoryAddress = "0x0a4F7930bC015fB87c67A55abc5D0F031A35B405"
  const bscLinkPortAddress = process.env.BNBTESTNET_LINKPORT_ADDRESS ||"0x911e2008BDd299e99555dBdbb8f7ba1053C670F9"; // BSC Testnet LinkPort address
  const bscNativePoolAddress = "0x2c5841B545487d4F4C44d0b732141dd3D03d05fD"
  const bscLinkPoolAddress = "0xf11935eb67fe7c505e93ed7751f8c59fc3199121"
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
    sourceLinkTokenAddress = ethLinkTokenAddress;
    sourceNativeTokenAddress = ethNativeTokenAddress;
    sourceUsdtTokenAddress = ethUsdtTokenAddress;
    sourceNativePoolAddress = ethNativePoolAddress;
    sourceLinkPoolAddress = ethLinkPoolAddress;
    sourceUsdtPoolAddress = ethUsdtPoolAddress;
    sourceNetwork = "ethereumSepolia";
    destNetwork = "bnbChainTestnet";

  } else if (network.name === "bnbChainTestnet") {
    sourceLinkPortAddress = bscLinkPortAddress;
    sourceLinkTokenAddress = bscLinkTokenAddress;
    sourceNativeTokenAddress = bscNativeTokenAddress;
    sourceUsdtTokenAddress = bscUsdtTokenAddress;
    sourceNativePoolAddress = bscNativePoolAddress;
    sourceLinkPoolAddress = bscLinkPoolAddress;
    sourceUsdtPoolAddress = bscUsdtPoolAddress;
    sourceNetwork = "bnbChainTestnet";
    destNetwork = "ethereumSepolia";
  } else {
    throw new Error(`Unsupported network: ${network.name}`);
  }

  const LinkPortFactory = await ethers.getContractFactory("LinkPort");
  const LiquidityPoolFactory = await ethers.getContractFactory("LiquidityPool")
  const sourceCCIP = getRouterConfig(sourceNetwork)
  const destCCIP = getRouterConfig(destNetwork)
  const sourceLinkPort = await LinkPortFactory.attach(sourceLinkPortAddress);
  const ccipRouter = await sourceLinkPort.ccipRouter();
  const destport = await sourceLinkPort.ports(destCCIP.chainSelector);
  const pool = await LiquidityPoolFactory.attach(ethUsdtPoolAddress);
  console.log("Source LinkPort address:", sourceLinkPortAddress);
  let price = await sourceLinkPort.getTokenPrice(sourceUsdtTokenAddress)
  console.log("Current usdt price", price)
  //const feed  =  await sourceLinkPort.priceFeeds(sourceLinkTokenAddress)
  //console.log("Current LINK price feed", feed)
  price = await sourceLinkPort.getTokenPrice(sourceLinkTokenAddress)
  console.log("Current link price", price)
  price = await sourceLinkPort.getTokenPrice(sourceNativeTokenAddress)
  console.log("Current native price", price)
  return;
  const tvl = await pool.getPoolBalance()
  const totalSupply = await pool.totalSupply()
  const port = await pool.port()
  const shares = await pool.balanceOf("0x171AC9736585F3F0d663eB06AfAd99cEC45c8581")
  const amount = 1000000000000000000000n
  const tolock = amount * tvl / totalSupply;
  console.log("Port address:", port);
  console.log("TVL of USDT Pool:", tvl)
  console.log("totalSupply of USDT Pool:", totalSupply)
  console.log("Shares of 0x171AC9736585F3F0d", shares)
  console.log("Amount to lock:", tolock)
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});