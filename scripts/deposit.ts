import { ethers } from "hardhat";

async function main() {
    const TToken = await ethers.getContractFactory("TToken");
    const token = await TToken.attach("0xf11935eb67FE7C505e93Ed7751f8c59Fc3199121"); // Replace with your TToken address

    const LiquidityPool = await ethers.getContractFactory("LiquidityPool");
    const pool = await LiquidityPool.attach("0x84911055429D2Aac0761153e2e33a3d37d26169d"); // Replace

    let tx ;

    tx =await token.approve(pool.address, ethers.utils.parseUnits("100", 18)); // Approve the pool to spend 100 USDC
    await tx.wait();

    tx = await pool.deposit(ethers.utils.parseUnits("100", 18))

    await tx.wait(); 

    console.log("Transfer successful!");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});