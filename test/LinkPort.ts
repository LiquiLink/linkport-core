import { expect } from "chai";
import hre from "hardhat";
import { ethers } from "hardhat";
// import { id, AbiCoder } from "ethers";
import {
  getEvm2EvmMessage,
  requestLinkFromTheFaucet,
  routeMessage,
} from "@chainlink/local/scripts/CCIPLocalSimulatorFork";
import {
  IRouterClient,
  IRouterClient__factory,
  BurnMintERC677Helper,
  LinkTokenInterface,
} from "../typechain-types";
import {
  getProviderRpcUrl,
  getLINKTokenAddress,
  getRouterConfig,
  getFaucetTokensAddresses,
} from "../helpers/utils";
import { link } from "fs";

describe("LinkPort CCIP Loan & Repay", function () {
  let alice: any, bob: any;
  let linkTokenFactory: any, sourcelinkToken: LinkTokenInterface;
  let sourceLinkPort: any, destinationLinkPort: any;
  let sourcePoolFactory: any, destPoolFactory: any;
  let sourceWETHPool: any, destWETHPool: any;
  let sourceSNXPool: any, destSNXPool: any;
  let sourceUSDTPool: any, destUSDTPool: any;
  let sourceWETH: any, destWETH: any;
  let sourceSNX: any, destSNX: any;
  let sourceUSDT: any, destUSDT: any;
  let sourceWETHPoolAddress: any, sourceSNXPoolAddress: any, sourceUSDTPoolAddress: any;
  let destWETHPoolAddress: any, destSNXPoolAddress: any, destUSDTPoolAddress: any;
  const [source, destination] = ["ethereumSepolia", "arbitrumSepolia"];
  const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';
  const ethAmount = hre.ethers.parseUnits("1000", "ether")
  let sourceSnapshotId: any;
  let destSnapshotId: any;
  const feeRate = 50; // 0.5%
  let tx;
  let blocknumber;
  let loanMsg: any;
  let repayMsg: any;
  let bridgeMsg:  any;

  const sourcelinkTokenAddress = getLINKTokenAddress(source);
  const destlinkTokenAddress = getLINKTokenAddress(destination);
  const sourceRouterAddress = getRouterConfig(source).address;
  const sourceChainSelector = getRouterConfig(source).chainSelector;
  const destinationRouterAddress = getRouterConfig(destination).address;
  const destinationChainSelector = getRouterConfig(destination).chainSelector;

  let poolFactoryFactory: any, WETHFactory: any, TokenFactory: any, linkPortFactory: any, LiquidityPoolFactory: any;

  const deploySource = async() => {
    // Fork source chain
    await hre.network.provider.request({
      method: "hardhat_reset",
      params: [
        {
          forking: {
            jsonRpcUrl: getProviderRpcUrl(source),
          },
        },
      ],
    });

    // deploy PoolFactory on source chain
    sourcePoolFactory = await poolFactoryFactory.deploy();
    console.log("Source Pool Factory Address:", sourcePoolFactory.target);
    //  deploy test Tokens USDT, SNX, WETH on source chain
    sourceUSDT = await TokenFactory.deploy("USDT", "USDT");
    console.log("Source USDT Address:", sourceUSDT.target);
    sourceSNX = await TokenFactory.deploy("SNX", "SNX");      
    console.log("Source SNX Address:", sourceSNX.target);
    sourceWETH = await WETHFactory.deploy();
    console.log("Source WETH Address:", sourceWETH.target);

    // Deploy LinkPort on both chains (simulate)
    sourceLinkPort = await linkPortFactory.deploy(
      sourcePoolFactory.target, // dummy PoolFactory
      sourceRouterAddress,
      sourcelinkTokenAddress
    );

    console.log("Source linkPort Address:", sourceLinkPort.target);


    await sourceLinkPort.setTokenPrice(sourceWETH.target, 2400 * 10 ** 8); // Set WETH price to $2400
    await sourceLinkPort.setTokenPrice(sourceSNX.target, 0.6 * 10 ** 8)
    await sourceLinkPort.setTokenPrice(sourceUSDT.target, 1 * 10 ** 8)

     await sourcePoolFactory.createPool(
      sourceLinkPort.target,
      sourceWETH.target,
      feeRate
    );
    await sourcePoolFactory.createPool(
      sourceLinkPort.target,
      sourceSNX.target,
      feeRate
    );
    tx = await sourcePoolFactory.createPool(
      sourceLinkPort.target,
      sourceUSDT.target,
      feeRate
    );
    await tx.wait()

    sourceWETHPoolAddress = await sourcePoolFactory.getPoolAddress(sourceWETH.target);
    sourceSNXPoolAddress = await sourcePoolFactory.getPoolAddress(sourceSNX.target);
    sourceUSDTPoolAddress = await sourcePoolFactory.getPoolAddress(sourceUSDT.target);
    console.log("Source WETH Pool deployed at:", sourceWETHPoolAddress);
    console.log("Source SNX Pool deployed at:", sourceSNXPoolAddress);
    console.log("Source USDT Pool deployed at:", sourceUSDTPoolAddress);

    sourceWETHPool = await LiquidityPoolFactory.attach(sourceWETHPoolAddress);
    sourceSNXPool = await LiquidityPoolFactory.attach(sourceSNXPoolAddress);
    sourceUSDTPool = await LiquidityPoolFactory.attach(sourceUSDTPoolAddress);

    /*
    await sourceUSDT.connect(alice).approve(sourceUSDTPool.target, 1000n * 10n ** 18n);
    await sourceUSDTPool.connect(alice).deposit(1000n * 10n ** 18n);
    console.log("Alice deposited 1000 USDT into source USDT Pool");
    await sourceSNX.connect(alice).approve(sourceSNXPool.target, 1000n * 10n ** 18n);
    await sourceSNXPool.connect(alice).deposit(1000n * 10n ** 18n);
    console.log("Alice deposited 1000 SNX into source SNX Pool");
    */
    await sourceWETHPool.connect(bob).depositNative({ value: ethAmount });
    console.log("Bob deposited 1000 WETH into source WETH Pool");
    /*
    await sourceWETHPool.connect(alice).depositNative({ value: ethAmount });
    */
    console.log("Deposited 1000 WETH into source WETH Pool");

    linkTokenFactory = await hre.ethers.getContractFactory("TToken");
    sourcelinkToken = linkTokenFactory.attach(sourcelinkTokenAddress)
    await requestLinkFromTheFaucet(sourcelinkTokenAddress, alice.address, 100n * 10n ** 18n);
    console.log("Source LINK balance:", (await sourcelinkToken.balanceOf(alice.address)).toString());
    tx = await sourcelinkToken.connect(alice).transfer(sourceLinkPort.target, 10n * 10n ** 18n);
    await tx.wait();
  }

  const deployDestination = async() => {
    console.log("Switching to destination chain:", destination);
    await hre.network.provider.request({
      method: "hardhat_reset",
      params: [
        {
          forking: {
            jsonRpcUrl: getProviderRpcUrl(destination),
          },
        },
      ],
    });
    blocknumber = await hre.network.provider.send("eth_blockNumber");
    console.log("Current block number: %d", blocknumber);

    // deploy PoolFactory on destination chain
    destPoolFactory = await poolFactoryFactory.deploy();
    console.log("Destination Pool Factory Address:", destPoolFactory.target);
    // deploy test Tokens USDT, SNX, WETH on destination chain
    destUSDT = await TokenFactory.deploy("USDT", "USDT");
    console.log("Destination USDT Address:", destUSDT.target);
    destSNX = await TokenFactory.deploy("SNX", "SNX");
    console.log("Destination SNX Address:", destSNX.target);
    destWETH = await WETHFactory.deploy();
    console.log("Destination WETH Address:", destWETH.target);


    // Deploy LinkPort on destination chain
    destinationLinkPort = await linkPortFactory.deploy(
      destPoolFactory.target, // dummy PoolFactory
      destinationRouterAddress,
      destlinkTokenAddress,
    );
    console.log("Destination LinkPort Address:", destinationLinkPort.target);


    await destinationLinkPort.setPort(sourceChainSelector, sourceLinkPort.target);
    console.log("Destination Link Port set for source chain:", sourceChainSelector);
    /*
    await destinationLinkPort.setToken(sourceUSDT.target, sourceChainSelector, destUSDT.target);
    await destinationLinkPort.setToken(sourceSNX.target, sourceChainSelector, destSNX.target);
    await destinationLinkPort.setToken(sourceWETH.target, sourceChainSelector, destWETH.target);
    await destinationLinkPort.setToken(destUSDT.target, sourceChainSelector, sourceUSDT.target);
    await destinationLinkPort.setToken(destSNX.target, sourceChainSelector, sourceSNX.target);
    await destinationLinkPort.setToken(destWETH.target, sourceChainSelector, sourceWETH.target);
    */

    await destinationLinkPort.setTokenPrice(destWETH.target, 2400 * 10 ** 8); // Set WETH price to $2400
    await destinationLinkPort.setTokenPrice(destSNX.target, 0.6 * 10 ** 8);
    await destinationLinkPort.setTokenPrice(destUSDT.target, 1 * 10 ** 8);

    await destPoolFactory.createPool(
      destinationLinkPort.target,
      destWETH.target,
      feeRate
    );
    await destPoolFactory.createPool(
      destinationLinkPort.target,
      destSNX.target,
      feeRate
    );
    tx = await destPoolFactory.createPool(
      destinationLinkPort.target,
      destUSDT.target,
      feeRate
    );
    await tx.wait()

    destWETHPoolAddress = await destPoolFactory.getPoolAddress(destWETH.target);
    destSNXPoolAddress = await destPoolFactory.getPoolAddress(destSNX.target);
    destUSDTPoolAddress = await destPoolFactory.getPoolAddress(destUSDT.target);
    console.log("Destination WETH Pool deployed at:", destWETHPoolAddress); 
    console.log("Destination SNX Pool deployed at:", destSNXPoolAddress);
    console.log("Destination USDT Pool deployed at:", destUSDTPoolAddress);


    destWETHPool = await LiquidityPoolFactory.attach(destWETHPoolAddress);
    destSNXPool = await LiquidityPoolFactory.attach(destSNXPoolAddress);
    destUSDTPool = await LiquidityPoolFactory.attach(destUSDTPoolAddress);

    await destUSDT.connect(alice).approve(destUSDTPool.target, 10000n * 10n ** 18n);
    await destUSDTPool.connect(alice).deposit(10000n * 10n ** 18n);
    console.log("Alice deposited 1000 USDT into destination USDT Pool");
    await destSNX.connect(alice).approve(destSNXPool.target, 1000n * 10n ** 18n);
    await destSNXPool.connect(alice).deposit(1000n * 10n ** 18n);
    console.log("Alice deposited 1000 SNX into destination SNX Pool");
    tx = await destWETHPool.connect(alice).depositNative({ value: ethAmount });
    await tx.wait();
    console.log("Alice Deposited 1000 WETH into destination WETH Pool");

    let linkToken = linkTokenFactory.attach(destlinkTokenAddress)
    await requestLinkFromTheFaucet(destlinkTokenAddress, alice.address, 100n * 10n ** 18n);
    console.log("Destination LINK balance:", (await linkToken.balanceOf(alice.address)).toString());
    tx = await linkToken.connect(alice).transfer(destinationLinkPort.target, 10n * 10n ** 18n);
    await tx.wait();
  }

  before(async () => {
    LiquidityPoolFactory = await hre.ethers.getContractFactory("LiquidityPool");
    WETHFactory = await hre.ethers.getContractFactory("WETH9");
    TokenFactory = await hre.ethers.getContractFactory("TToken");
    poolFactoryFactory = await hre.ethers.getContractFactory("PoolFactory");
    linkPortFactory = await hre.ethers.getContractFactory("LinkPort");
    [alice, bob] = await hre.ethers.getSigners();
    console.log("Alice address:", alice.address);
    await deploySource();
    await deployDestination();
  })

  it("Should send loan & bridge ia CCIP on source chain", async function () {

    await deploySource();
    // Register port addresses for cross-chain messaging
    await sourceLinkPort.setPort(destinationChainSelector, destinationLinkPort.target);

    await sourceLinkPort.setToken(sourceUSDT.target, destinationChainSelector, destUSDT.target);
    await sourceLinkPort.setToken(destUSDT.target, destinationChainSelector, sourceUSDT.target);
    await sourceLinkPort.setUniswapV2Router("0x1675325a59017823c9417DE46EF55Bbe4ca3136c")

    tx = await sourceLinkPort.connect(bob).loan(destinationChainSelector, sourceWETH.target, [destUSDT.target], [50n * 10n ** 18n], [10n * 10n ** 18n]);
    const loanReceipt = await tx.wait();
    loanMsg = getEvm2EvmMessage(loanReceipt);
    console.log("Loan message:", loanMsg);

    await sourceUSDT.connect(alice).transfer(bob.address, ethAmount);

    await sourceUSDT.connect(bob).approve(sourceLinkPort.target, ethAmount);

    tx = await sourceLinkPort.connect(bob).bridge(destinationChainSelector, sourceUSDT.target, ethAmount, [sourceUSDT.target], [100])
    const bridgeReceipt = await tx.wait();

    bridgeMsg = getEvm2EvmMessage(bridgeReceipt);

    console.log("Bridge Msg", bridgeMsg);
  });

  it("Should perform loan & bridge on destination chain", async function () {

    await deployDestination();

    const beforeBalance = await destUSDT.balanceOf(bob.address);
    console.log("Bob's USDT balance before loan:", beforeBalance.toString());

    await routeMessage(destinationRouterAddress, loanMsg);

    const afterBalance = await destUSDT.balanceOf(bob.address);
    console.log("Bob's USDT balance after loan:", afterBalance.toString());


    await destUSDT.connect(bob).approve(destUSDTPoolAddress, 50n * 10n ** 18n);

    tx = await destinationLinkPort.connect(bob).repay(sourceChainSelector, sourceWETH.target, [destUSDT.target], [40n * 10n ** 18n]);
    const receipt = await tx.wait();
    repayMsg = getEvm2EvmMessage(receipt);
    console.log("Repay Msg", repayMsg);
    /*
   bridgeMsg = {
        sourceChainSelector: 16015286601757825753n,
        sender: '0xD5f5227c83d6D25b9a8090c36372A7D567c6b64b',
        receiver: '0x1459213733F023b55444487eE9385A8266FD0F08',
        sequenceNumber: 7130n,
        gasLimit: 1000000n,
        strict: false,
        nonce: 2n,
        feeToken: '0x779877A7B0D9E8603169DdbD7836e478b4624789',
        feeTokenAmount: 69671625449526031n,
        data: '0x000000000000000000000000000000000000000000000000000000000000000300000000000000000000000070997970c51812dc3a010c7d01b50e0d17dc79c800000000000000000000000070997970c51812dc3a010c7d01b50e0d17dc79c800000000000000000000000000000000000000000000000000000000000001000000000000000000000000000000000000000000000000000000000000000140000000000000000000000000929954b91f9a9946924ce1dd58a03e1d603f7e4400000000000000000000000000000000000000000000000000000000000001800000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000100000000000000000000000042d05efde772c95c48863e43478b489a250ce7c4000000000000000000000000000000000000000000000000000000000000000100000000000000000000000000000000000000000000003635c9adc5dea000000000000000000000000000000000000000000000000000000000000000000000',
        tokenAmounts: [],
        sourceTokenData: [],
        destTokenAmounts: [],
        messageId: '0x1179a1d6c62a3cda6b207b3f7392a8608b729e3885e0e999e248f4ec407d0581'                                                                                                                                         
    }

    //await destinationLinkPort.test(bridgeMsg)
    */

    await routeMessage(destinationRouterAddress, bridgeMsg);

    const afterBridgeBalance = await destUSDT.balanceOf(bob.address);
    console.log("Bob's USDT balance after bridge:", afterBridgeBalance.toString());

  })

  it("Should perform repay on source chain", async function () {
    if (!repayMsg) {
      throw new Error("Repay message not found. Ensure the loan was executed first.");
    }
    await deploySource();
    await sourceLinkPort.setPort(destinationChainSelector, destinationLinkPort.target);
    tx = await sourceLinkPort.connect(bob).loan(destinationChainSelector, sourceWETH.target, [destUSDT.target], [50n * 10n ** 18n], [10n * 10n ** 18n]);
    await tx.wait();
    const beforebobLockedBalance = await sourceWETHPool.lockedAmount(bob.address)

    console.log("Bob's locked WETH before repay:", beforebobLockedBalance.toString());

    //await sourceLinkPort.connect(bob).test(repayMsg);

    await routeMessage(sourceRouterAddress, repayMsg);

    const afterbobLockedBalance = await sourceWETHPool.lockedAmount(bob.address)
    console.log("Bob's locked WETH after repay:", afterbobLockedBalance.toString());



  })

})
