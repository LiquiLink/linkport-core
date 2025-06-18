import { ethers } from "hardhat";
import { MultiTokenWallet } from "../typechain";

async function main() {
    const [deployer] = await ethers.getSigners();
    const walletAddress = "YOUR_WALLET_ADDRESS"; // Replace with your deployed contract address
    const multiTokenWallet = (await ethers.getContractAt("MultiTokenWallet", walletAddress)) as MultiTokenWallet;

    // Function to deposit tokens
    async function deposit(tokenAddress: string, amount: string) {
        const tokenContract = await ethers.getContractAt("IERC20", tokenAddress);
        await tokenContract.approve(walletAddress, amount);
        await multiTokenWallet.deposit(tokenAddress, amount);
        console.log(`Deposited ${amount} tokens to the wallet.`);
    }

    // Function to withdraw tokens
    async function withdraw(tokenAddress: string, amount: string) {
        await multiTokenWallet.withdraw(tokenAddress, amount);
        console.log(`Withdrew ${amount} tokens from the wallet.`);
    }

    // Function to transfer tokens between users
    async function transfer(from: string, to: string, tokenAddress: string, amount: string, signature: string) {
        await multiTokenWallet.transfer(from, to, tokenAddress, amount, signature);
        console.log(`Transferred ${amount} tokens from ${from} to ${to}.`);
    }

    // Example usage
    // await deposit("TOKEN_ADDRESS", "1000000000000000000"); // 1 token
    // await withdraw("TOKEN_ADDRESS", "1000000000000000000"); // 1 token
    // await transfer("FROM_ADDRESS", "TO_ADDRESS", "TOKEN_ADDRESS", "1000000000000000000", "SIGNATURE");

}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});