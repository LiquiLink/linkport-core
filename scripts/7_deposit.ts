import { ethers, network } from "hardhat";

import {
  getRouterConfig,
  getLINKTokenAddress
} from "../helpers/utils"

async function main() {
  const ethNativeTokenAddress = "0xfFf9976782d46CC05630D1f6eBAb18b2324d6B14";
  const ethLinkTokenAddress = "0x391e62e754caa820b606703d1920c34a35792dd6"; // Sepolia LINK address
  const ethUsdtTokenAddress = "0xa28C606a33AF8175F3bBf71d74796aDa360f4C49"; // Sepolia USDT address
  const ethLinkPortAddress = process.env.SEPOLIA_LINKPORT_ADDRESS || "0xD03BAe9d0367ad9241243408D1137AfC92F2efe6"; // Sepolia LinkPort address
  const ethUniswapRouterAddress = "0x1675325a59017823c9417DE46EF55Bbe4ca3136c"; // Uniswap V2 Router address
    // BSC Testnet WBNB address
  const bscNativeTokenAddress = "0xae13d989daC2f0dEbFf460aC112a837C89BAa7cd";
  const bscLinkTokenAddress = "0xf11935eb67fe7c505e93ed7751f8c59fc3199121"; // BSC Testnet LINK address
  const bscUsdtTokenAddress = "0x5016F623414b344a5C26ffDa4e61956c9a41Ca1e"; // BSC Testnet USDT address
  const bscLinkPortAddress = "0x24F81DA0aBBD2a88605E4B140880647F26178744"; // BSC Testnet LinkPort address
  const bscUniswapRouterAddress = "0xD99D1c33F9fC3444f8101754aBC46c52416550D1"; // PancakeSwap Router address


  let sourceLinkPortAddress : string
  let sourceNetwork;
  let poolFactoryAddress: string;
  let swapRouterAddress: string;
  let link;
  let usdt;
  let native;
  if (network.name === "ethereumSepolia") {
    sourceLinkPortAddress = ethLinkPortAddress;
    link = ethLinkTokenAddress;
    usdt = ethUsdtTokenAddress;
    native = ethNativeTokenAddress;
    sourceNetwork = "ethereumSepolia";
    poolFactoryAddress = process.env.SEPOLIA_FACTORY_ADDRESS || "0x1453298DaE6c7B60Ba41766F658404D967070759";
    swapRouterAddress = ethUniswapRouterAddress;

  } else if (network.name === "bnbChainTestnet") {
    sourceNetwork = "bnbChainTestnet";
    poolFactoryAddress = process.env.BNBTESTNET_FACTORY_ADDRESS || "0x1453298DaE6c7B60Ba41766F658404D967070759";
    link = bscLinkTokenAddress;
    usdt = bscUsdtTokenAddress;
    native = bscNativeTokenAddress;
  } else {
    throw new Error(`Unsupported network: ${network.name}`);
  }

  const PoolFactory = await ethers.getContractFactory("PoolFactory")
  const Token = await ethers.getContractFactory("TToken")
  const LiquidityPoolFactory = await ethers.getContractFactory("LiquidityPool")

  const poolFactory = await PoolFactory.attach(poolFactoryAddress);

  const linkAmount = ethers.parseUnits("100000", "ether")

  const linkPoolAddress = await poolFactory.getPool(link);
  const linkToken = await Token.attach(link);
  const linkPool = await LiquidityPoolFactory.attach(linkPoolAddress);

  let tx;

  tx = await linkToken.approve(linkPoolAddress, linkAmount);
  await tx.wait();
  await linkPool.deposit(linkAmount)

  const usdtAmount = ethers.parseUnits("1000000", "ether")

  const usdtPoolAddress = await poolFactory.getPool(usdt);
  const usdtToken = await Token.attach(usdt);
  const usdtPool = await LiquidityPoolFactory.attach(usdtPoolAddress);

  tx = await usdtToken.approve(usdtPoolAddress, usdtAmount);
  await tx.wait();
  await usdtPool.deposit(usdtAmount)


  const navitveAmount = ethers.parseUnits("0.01", "ether")

  const navitvePoolAddress = await poolFactory.getPool(native);
  const nativePool = await LiquidityPoolFactory.attach(navitvePoolAddress);

  await nativePool.depositNative({value: navitveAmount});

}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});