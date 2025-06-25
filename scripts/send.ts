import { network,ethers } from "hardhat";

async function main() {
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
  const TToken = await ethers.getContractFactory("TToken");
  const link = await TToken.attach(linkTokenAddress); // Replace with your TToken address
  const usdt = await TToken.attach(usdtTokenAddress); // Replace with your TToken address
  let tx
  tx = await link.transfer("0xe28D37E094AC43Fc264bAb5263b3694b985B39df", ethers.utils.parseUnits("1000000", 18)); // Transfer 100 USDC to the specified address
  await tx.wait();
  tx = await usdt.transfer("0xe28D37E094AC43Fc264bAb5263b3694b985B39df", ethers.utils.parseUnits("1000000", 18)); // Transfer 100 USDC to the specified address
  await tx.wait();
  console.log("Transfer successful!");

}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});