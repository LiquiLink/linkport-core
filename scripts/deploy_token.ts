import { ethers } from "hardhat";

async function main() {
    const TToken = await ethers.getContractFactory("TToken");
    const token = await TToken.deploy("BNB", "BNB");
    console.log("BNB deployed to:", token.address, token.target);

}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });