const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("LiquidityPool", function () {
    let liquidityPool;
    let owner;
    let alice;
    let bob;
    let usdt;
    let bnb;

    beforeEach(async function () {
        [owner, alice, bob] = await ethers.getSigners();

        const USDT = await ethers.getContractFactory("MockToken");
        usdt = await USDT.deploy("Tether USD", "USDT", ethers.utils.parseUnits("1000000", 18));
        await usdt.deployed();

        const BNB = await ethers.getContractFactory("MockToken");
        bnb = await BNB.deploy("Binance Coin", "BNB", ethers.utils.parseUnits("1000000", 18));
        await bnb.deployed();

        const LiquidityPool = await ethers.getContractFactory("LiquidityPool");
        liquidityPool = await LiquidityPool.deploy(usdt.address, bnb.address);
        await liquidityPool.deployed();
    });

    describe("Deposit", function () {
        it("should allow users to deposit USDT", async function () {
            await usdt.connect(alice).approve(liquidityPool.address, ethers.utils.parseUnits("1000", 18));
            await liquidityPool.connect(alice).deposit(ethers.utils.parseUnits("1000", 18));

            const balance = await liquidityPool.getBalance(alice.address);
            expect(balance).to.equal(ethers.utils.parseUnits("1000", 18));
        });
    });

    describe("Withdraw", function () {
        it("should allow users to withdraw BNB and USDT", async function () {
            await usdt.connect(alice).approve(liquidityPool.address, ethers.utils.parseUnits("1000", 18));
            await liquidityPool.connect(alice).deposit(ethers.utils.parseUnits("1000", 18));

            await liquidityPool.connect(alice).withdraw(ethers.utils.parseUnits("800", 18));

            const balanceUSDT = await usdt.balanceOf(alice.address);
            const balanceBNB = await bnb.balanceOf(alice.address);
            expect(balanceUSDT).to.be.greaterThan(0);
            expect(balanceBNB).to.be.greaterThan(0);
        });
    });

    describe("Fee Calculation", function () {
        it("should calculate fees correctly on withdrawal", async function () {
            await usdt.connect(alice).approve(liquidityPool.address, ethers.utils.parseUnits("1000", 18));
            await liquidityPool.connect(alice).deposit(ethers.utils.parseUnits("1000", 18));

            const initialBalance = await usdt.balanceOf(alice.address);
            await liquidityPool.connect(alice).withdraw(ethers.utils.parseUnits("800", 18));
            const finalBalance = await usdt.balanceOf(alice.address);

            expect(finalBalance).to.be.below(initialBalance);
        });
    });
});