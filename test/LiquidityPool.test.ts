import { expect } from "chai";
import { ethers } from "hardhat";
import { Contract, Signer } from "ethers";

describe("LiquidityPool deposit & withdraw", function () {
  let owner: Signer, user1: Signer, user2: Signer, port: Signer;
  let token: Contract;
  let poolFactory: Contract;
  let pool: Contract;
  let poolAddress: string;
  const depositAmount = ethers.utils.parseEther("1000");
  const feeRate = 50; // 0.5%

  beforeEach(async function () {
    [owner, user1, user2, port] = await ethers.getSigners();

    // Deploy ERC20 test token
    const Token = await ethers.getContractFactory("TToken");
    token = await Token.deploy("TestToken", "TTK");
    await token.deployed();

    // Transfer tokens to user1 and user2
    await token.transfer(await user1.getAddress(), ethers.utils.parseEther("10000"));
    await token.transfer(await user2.getAddress(), ethers.utils.parseEther("10000"));

    // Deploy PoolFactory
    const PoolFactory = await ethers.getContractFactory("PoolFactory");
    poolFactory = await PoolFactory.deploy();
    await poolFactory.deployed();

    // Create pool via factory
    const tx = await poolFactory.createPool(await port.getAddress(), token.address, feeRate);
    await tx.wait();
    poolAddress = await poolFactory.getPool(token.address);

    // Attach LiquidityPool contract instance
    const LiquidityPool = await ethers.getContractFactory("LiquidityPool");
    pool = LiquidityPool.attach(poolAddress);
  });

  it("should allow deposit and mint shares", async function () {
    // Approve pool contract to spend tokens
    await token.connect(user1).approve(pool.address, depositAmount);

    // Deposit tokens
    await pool.connect(user1).deposit(depositAmount)

  });

  it("should allow withdraw and burn shares", async function () {
    // Deposit first
    await token.connect(user1).approve(pool.address, depositAmount);
    await pool.connect(user1).deposit(depositAmount);

    // Withdraw tokens
   await pool.connect(user1).withdraw(depositAmount)

  });

  it("should revert withdraw if not enough shares", async function () {
    await token.connect(user1).approve(pool.address, depositAmount);
    await pool.connect(user1).deposit(depositAmount);
  });
});