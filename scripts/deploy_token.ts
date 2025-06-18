import { ethers } from "hardhat";

async function main() {
    const MarFinToken = await ethers.getContractFactory("MarFinToken");
    const mft = await MarFinToken.deploy("MarFin Token", "MFT");
    await mft.deployed();
    console.log("MarFinToken deployed to:", mft.address);

    const usdt = await MarFinToken.deploy("Tether USD", "USDT");
    await usdt.deployed();
    console.log("Tether USD deployed to:", usdt.address);
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });