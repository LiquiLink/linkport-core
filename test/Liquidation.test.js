const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("Liquidation Contract", function () {
    let Liquidation;
    let liquidation;
    let owner;
    let user1;
    let user2;

    beforeEach(async function () {
        [owner, user1, user2] = await ethers.getSigners();
        Liquidation = await ethers.getContractFactory("Liquidation");
        liquidation = await Liquidation.deploy();
        await liquidation.deployed();
    });

    it("should trigger liquidation correctly", async function () {
        // Setup initial conditions for liquidation
        await liquidation.setCollateral(user1.address, 1000); // Example collateral
        await liquidation.setDebt(user1.address, 800); // Example debt

        // Trigger liquidation
        await liquidation.triggerLiquidation(user1.address);

        // Check if the user has been liquidated
        const isLiquidated = await liquidation.isLiquidated(user1.address);
        expect(isLiquidated).to.be.true;
    });

    it("should not allow liquidation if debt is repaid", async function () {
        // Setup initial conditions
        await liquidation.setCollateral(user1.address, 1000);
        await liquidation.setDebt(user1.address, 800);
        
        // Repay the debt
        await liquidation.repayDebt(user1.address, 800);

        // Attempt to trigger liquidation
        await expect(liquidation.triggerLiquidation(user1.address)).to.be.revertedWith("Debt must be unpaid for liquidation");
    });

    it("should manage collateral correctly during liquidation", async function () {
        // Setup initial conditions
        await liquidation.setCollateral(user1.address, 1000);
        await liquidation.setDebt(user1.address, 800);

        // Trigger liquidation
        await liquidation.triggerLiquidation(user1.address);

        // Check if collateral has been adjusted
        const collateralAfterLiquidation = await liquidation.getCollateral(user1.address);
        expect(collateralAfterLiquidation).to.equal(0); // Assuming all collateral is liquidated
    });
});