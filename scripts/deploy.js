const hre = require("hardhat");

async function main() {
    // Deploy TokenWhitelist contract
    const TokenWhitelist = await hre.ethers.getContractFactory("TokenWhitelist");
    const tokenWhitelist = await TokenWhitelist.deploy();
    await tokenWhitelist.deployed();
    console.log("TokenWhitelist deployed to:", tokenWhitelist.address);

    // Deploy CCIPMsgBridge contract
    const CCIPMsgBridge = await hre.ethers.getContractFactory("CCIPMsgBridge");
    const ccipMsgBridge = await CCIPMsgBridge.deploy(tokenWhitelist.address);
    await ccipMsgBridge.deployed();
    console.log("CCIPMsgBridge deployed to:", ccipMsgBridge.address);

    // Deploy LiquidityPool contract
    const LiquidityPool = await hre.ethers.getContractFactory("LiquidityPool");
    const liquidityPool = await LiquidityPool.deploy(tokenWhitelist.address);
    await liquidityPool.deployed();
    console.log("LiquidityPool deployed to:", liquidityPool.address);

    // Deploy Liquidation contract
    const Liquidation = await hre.ethers.getContractFactory("Liquidation");
    const liquidation = await Liquidation.deploy(liquidityPool.address);
    await liquidation.deployed();
    console.log("Liquidation deployed to:", liquidation.address);
}

// Execute the deployment script
main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });