import { ethers, network } from "hardhat";

async function main() {
  // Select WETH or WBNB based on network
  let nativeTokenAddress: string;
  let linkTokenAddress: string;
  let usdtTokenAddress: string;
  let poolFactoryAddress: string
  if (network.name === "sepolia") {
    // Sepolia WETH address
    nativeTokenAddress = "0xfFf9976782d46CC05630D1f6eBAb18b2324d6B14";
    linkTokenAddress = "0x391E62e754CaA820B606703D1920c34a35792dd6"; // Sepolia LINK address
    usdtTokenAddress = "0xa28C606a33AF8175F3bBf71d74796aDa360f4C49"; // Sepolia USDT address
    poolFactoryAddress = "0x1453298DaE6c7B60Ba41766F658404D967070759"
  } else if (network.name === "bnbtestnet") {
    // BSC Testnet WBNB address
    nativeTokenAddress = "0xae13d989daC2f0dEbFf460aC112a837C89BAa7cd";
    linkTokenAddress = "0xf11935eb67FE7C505e93Ed7751f8c59Fc3199121"; // BSC Testnet LINK address
    usdtTokenAddress = "0x5016F623414b344a5C26ffDa4e61956c9a41Ca1e"; // BSC Testnet USDT address
    poolFactoryAddress = "0x0a4F7930bC015fB87c67A55abc5D0F031A35B405"
  } else {
    throw new Error(`Unsupported network: ${network.name}`);
  }

  const [deployer] = await ethers.getSigners();
  const feeRate = 20;

  // 2. Deploy PoolFactory
  const PoolFactory = await ethers.getContractFactory("PoolFactory");
  //const poolFactory = await PoolFactory.deploy();
  const poolFactory = await PoolFactory.attach(poolFactoryAddress);
  //await poolFactory.deployed();
  console.log("PoolFactory deployed to:", poolFactory.address);

  /*
  // 1. Deploy TToken
  const TToken = await ethers.getContractFactory("TToken");
  //const link = await TToken.deploy("LINK", "LINK");
  const link = await TToken.attach(linkTokenAddress)
  //await link.deployed();
  console.log("LINK deployed to:", link.address);
  //const usdt = await TToken.deploy("USDT", "USDT");
  //await usdt.deployed();
  const usdt = await TToken.attach(usdtTokenAddress)
  console.log("USDT deployed to:", usdt.address);


  // 3. Deploy a LiquidityPool via PoolFactory
  const link_tx = await poolFactory.createPool(deployer.address, link.address, feeRate);
  await link_tx.wait();
  const link_poolAddress = await poolFactory.getPool(link.address);
  console.log("LINK LiquidityPool deployed to:", link_poolAddress);

  const usdt_tx = await poolFactory.createPool(deployer.address, usdt.address, feeRate);
  await usdt_tx.wait();
  const usdt_poolAddress = await poolFactory.getPool(usdt.address);
  console.log("USDT LiquidityPool deployed to:", usdt_poolAddress);

  */
  

  const native_tx = await poolFactory.createPool(deployer.address, nativeTokenAddress, feeRate);
  await native_tx.wait();
  const native_poolAddress = await poolFactory.getPool(nativeTokenAddress);
  console.log("Native LiquidityPool deployed to:", native_poolAddress);
  /*

  // 4. Deploy LinkPort
  const dummyCCIPRouter = ethers.constants.AddressZero;
  const dummyTargetChainSelector = 0;
  const LinkPort = await ethers.getContractFactory("LinkPort");
  const linkPort = await LinkPort.deploy(poolFactory.address, dummyCCIPRouter, dummyTargetChainSelector);
  await linkPort.deployed();
  console.log("LinkPort deployed to:", linkPort.address);
  */
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});