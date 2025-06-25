import { expect } from "chai";
import hre from "hardhat";
// import { ethers } from "hardhat";
//import { id, AbiCoder } from "ethers";
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

describe("LinkPort CCIP Loan & Repay", function () {
  it("Should perform cross-chain loan and repay via CCIP", async function () {
    const [alice] = await hre.ethers.getSigners();
    const [source, destination] = ["ethereumSepolia", "arbitrumSepolia"];
    const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';

    // Setup addresses and contracts
    const sourcelinkTokenAddress = getLINKTokenAddress(source);
    const destlinkTokenAddress = getLINKTokenAddress(destination);
    const sourceRouterAddress = getRouterConfig(source).address;
    const sourceChainSelector = getRouterConfig(source).chainSelector;
    const destinationRouterAddress = getRouterConfig(destination).address;
    const destinationChainSelector = getRouterConfig(destination).chainSelector;

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

    const LiquidityPoolFactory = await hre.ethers.getContractFactory("LiquidityPool");
    const WETHFactory = await hre.ethers.getContractFactory("WETH9");
    const poolFactoryFactory = await hre.ethers.getContractFactory("PoolFactory");
    const sourcePoolFactory = await poolFactoryFactory.deploy();

    console.log("Source Pool Factory Address:", sourcePoolFactory.target);

    // Deploy LinkPort on both chains (simulate)
    const linkPortFactory = await hre.ethers.getContractFactory("LinkPort");
    const sourceLinkPort = await linkPortFactory.deploy(
      sourcePoolFactory.target, // dummy PoolFactory
      sourceRouterAddress,
      sourcelinkTokenAddress
    );
    console.log("Source linkPort Address:", sourceLinkPort.target);

    const sourceWETH = await WETHFactory.deploy();

    /*
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

    const destPoolFactory = await poolFactoryFactory.deploy();

    console.log("Destination Pool Factory Address:", destPoolFactory.target);


    const destinationLinkPort = await linkPortFactory.deploy(
      destPoolFactory.target, // dummy PoolFactory
      destinationRouterAddress,
      destlinkTokenAddress,
    );
    console.log("Destination LinkPort Address:", destinationLinkPort.target);

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

    */

    // Register port addresses for cross-chain messaging
    // await sourceLinkPort.setPort(destinationChainSelector, destinationLinkPort.target);
    await sourceLinkPort.setPort(destinationChainSelector, "0x34d9B6eD9E6bcc09742643Ec73126BAEdfff1Cf6");
    console.log("Source Link Port set for destination chain:", destinationChainSelector);

    /*
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

    await destinationLinkPort.setPort(sourceChainSelector, sourceLinkPort.target);
    console.log("Destination Link Port set for source chain:", sourceChainSelector);

    // --- Deploy Link liquidity pool on both source and destination chains ---
    // On source chain
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
    */

    //await sourcePoolFactory.deployed();

    const feeRate = 50; // 0.5%
    /*
    const tx1 = await sourcePoolFactory.createPool(
      sourceLinkPort.target,
      sourcelinkTokenAddress,
      feeRate
    );
    await tx1.wait();
    console.log("Source Pool Factory created pool for LINK");
    console.log("Source Link Pool deployed at:", sourceLinkPoolAddress);
    */
    const tx3 = await sourcePoolFactory.createPool(
      sourceLinkPort.target,
      sourceWETH.target,
      feeRate
    );
    await tx3.wait();
    console.log("Source Pool Factory created pool for ETH");

    // const sourceLinkPoolAddress = await sourcePoolFactory.getPoolAddress(sourcelinkTokenAddress);
    const sourceEthPoolAddress = await sourcePoolFactory.getPoolAddress(sourceWETH.target);
    console.log("Source ETH Pool deployed at:", sourceEthPoolAddress);

    /*
    // On destination chain
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

    //await destPoolFactory.deployed();

    const tx2 = await destPoolFactory.createPool(
      destinationLinkPort.target,
      destlinkTokenAddress,
      feeRate
    );
    await tx2.wait();

    const tx4 = await destPoolFactory.createPool(
      destinationLinkPort.target,
      ZERO_ADDRESS,
      feeRate
    );
    await tx4.wait();
    const destLinkPoolAddress = await destPoolFactory.getPoolAddress(destlinkTokenAddress);
    const destEthPoolAddress = await destPoolFactory.getPoolAddress(ZERO_ADDRESS);
    console.log("Destination Link Pool deployed at:", destLinkPoolAddress);
    console.log("Destination ETH Pool deployed at:", destEthPoolAddress);

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
    */

    // Prepare LINK for CCIP fee
    const linkTokenFactory = await hre.ethers.getContractFactory("TToken");
    const sourcelinkToken = linkTokenFactory.attach(sourcelinkTokenAddress)
    await requestLinkFromTheFaucet(sourcelinkTokenAddress, alice.address, 100n * 10n ** 18n);
    console.log("Source LINK balance:", (await sourcelinkToken.balanceOf(alice.address)).toString());
    await sourcelinkToken.connect(alice).transfer(sourceLinkPort.target, 10n * 10n ** 18n);

    //const sourceLinkPool = await LiquidityPoolFactory.attach(sourceLinkPoolAddress);
    const sourceEthPool = await LiquidityPoolFactory.attach(sourceEthPoolAddress);

    let tx ;
    //tx = await sourcelinkToken.connect(alice).transfer(sourceLinkPort.target, 100n * 10n ** 18n);
    //await tx.wait();
    //console.log("Transferred 100 LINK to source Link Port");
    //tx = await sourceLinkPool.connect(alice).deposit(100n * 10n ** 18n);
    //console.log("Deposited 100 LINK into source Link Pool");
    //await tx.wait()
    tx = await sourceEthPool.connect(alice).depositNative({ value: 100n * 10n ** 18n });
    console.log("Deposited 100 ETH into source ETH Pool");
    await tx.wait()

    /*
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

    const destlinkToken = linkTokenFactory.attach(destlinkTokenAddress)
    await requestLinkFromTheFaucet(destlinkTokenAddress, alice.address, 100n * 10n ** 18n);
    console.log("Destination LINK balance:", (await destlinkToken.balanceOf(alice.address)).toString());
    await sourcelinkToken.connect(alice).transfer(sourceLinkPort.target, 10n * 10n ** 18n);

    const destLinkPool = await LiquidityPoolFactory.attach(destLinkPoolAddress);
    const destEthPool = await LiquidityPoolFactory.attach(destEthPoolAddress);

    tx = await destlinkToken.connect(alice).transfer(destinationLinkPort.target, 100n * 10n ** 18n);
    await tx.wait();
    console.log("Transferred 100 LINK to destination Link Port")
    tx = await destLinkPool.connect(alice).deposit(100n * 10n ** 18n);
    console.log("Deposited 100 LINK into dest Link Pool");
    await tx.wait()
    tx = await destEthPool.connect(alice).depositNative({ value: 100n * 10n ** 18n });
    console.log("Deposited 100 ETH into dest ETH Pool");
    await tx.wait()

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
    */

    console.log("loan to ", destinationChainSelector);

    tx = await sourceLinkPort.loan(destinationChainSelector, sourceWETH.target, 10n * 10n ** 18n, [sourcelinkTokenAddress], [50n * 10n ** 18n]);

    const receipt = await tx.wait();
    console.log("loan receipt", receipt)

    const evm2EvmMessage = getEvm2EvmMessage(receipt);
    console.log("EVM2EVM message:", evm2EvmMessage);


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

    await routeMessage(destinationRouterAddress, evm2EvmMessage);

    return;

    /*
    // Prepare loan parameters
    const collateralToken = sourceCCIPBnMTokenAddress;
    const collateralAmount = 100n;
    const borrowTokens = [sourceCCIPBnMTokenAddress];
    const borrowAmounts = [50n];

    // Simulate loan (calls LinkPort.loan, which triggers CCIP)
    await sourceLinkPort.connect(alice).loan(
      destinationChainSelector,
      collateralToken,
      collateralAmount,
      borrowTokens,
      borrowAmounts
    );

    // Get the CCIP message from the router
    const routerTxs = await hre.ethers.provider.getBlockWithTransactions("latest");
    const ccipSendTx = routerTxs.transactions.find((tx) => tx.to?.toLowerCase() === sourceRouterAddress.toLowerCase());
    expect(ccipSendTx, "No CCIP send tx found").to.exist;

    const receipt = await hre.ethers.provider.getTransactionReceipt(ccipSendTx!.hash);
    const evm2EvmMessage = getEvm2EvmMessage(receipt);
    expect(evm2EvmMessage, "No EVM2EVM message found").to.exist;

    // Fork destination chain and route the message
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

    await routeMessage(destinationRouterAddress, evm2EvmMessage);

    // Check that the loan event was emitted on destination
    // (You may want to check balances or emitted events here)

    // Now test repay
    // Approve LinkPort to spend tokens for repay
    await destinationCCIPBnM.connect(alice).approve(await destinationLinkPort.getAddress(), 50n);

    // Simulate repay (calls LinkPort.repay, which triggers CCIP)
    await destinationLinkPort.connect(alice).repay(
      getRouterConfig(source).chainSelector,
      destinationCCIPBnMTokenAddress,
      50n
    );

    // Get the CCIP message from the router
    const repayRouterTxs = await hre.ethers.provider.getBlockWithTransactions("latest");
    const repayCcipSendTx = repayRouterTxs.transactions.find((tx) => tx.to?.toLowerCase() === destinationRouterAddress.toLowerCase());
    expect(repayCcipSendTx, "No CCIP repay send tx found").to.exist;

    const repayReceipt = await hre.ethers.provider.getTransactionReceipt(repayCcipSendTx!.hash);
    const repayEvm2EvmMessage = getEvm2EvmMessage(repayReceipt);
    expect(repayEvm2EvmMessage, "No EVM2EVM repay message found").to.exist;

    // Fork back to source chain and route the repay message
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

    await routeMessage(sourceRouterAddress, repayEvm2EvmMessage);

    // Check that the repay event was emitted on source
    // (You may want to check balances or emitted events here)
    */

  });
})
