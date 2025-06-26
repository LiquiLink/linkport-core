import { expect } from "chai";
import hre from "hardhat";
// import { ethers } from "hardhat";
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
    await sourceLinkPort.setPort(sourceChainSelector, "0x34d9B6eD9E6bcc09742643Ec73126BAEdfff1Cf6");
    console.log("Source Link Port set for destination chain:", destinationChainSelector);

    await sourceLinkPort.setTokenPrice(sourceWETH.target, 2400);
    await sourceLinkPort.setTokenPrice(sourcelinkTokenAddress, 13);

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
    const tx1 = await sourcePoolFactory.createPool(
      sourceLinkPort.target,
      sourcelinkTokenAddress,
      feeRate
    );
    await tx1.wait();
    console.log("Source Pool Factory created pool for LINK");
    const tx3 = await sourcePoolFactory.createPool(
      sourceLinkPort.target,
      sourceWETH.target,
      feeRate
    );
    await tx3.wait();
    console.log("Source Pool Factory created pool for ETH");

    const sourceLinkPoolAddress = await sourcePoolFactory.getPoolAddress(sourcelinkTokenAddress);
    console.log("Source Link Pool deployed at:", sourceLinkPoolAddress);
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

    const sourceLinkPool = await LiquidityPoolFactory.attach(sourceLinkPoolAddress);
    const sourceEthPool = await LiquidityPoolFactory.attach(sourceEthPoolAddress);

    let tx ;
    tx = await sourcelinkToken.connect(alice).transfer(sourceLinkPort.target, 100n * 10n ** 18n);
    await tx.wait();
    console.log("Transferred 100 LINK to source Link Port");

    tx = await sourcelinkToken.connect(alice).approve(sourceLinkPool.target, 1000n * 10n ** 18n);
    await tx.wait();
    tx = await sourceLinkPool.connect(alice).deposit(1000n * 10n ** 18n);
    console.log("Deposited 1000 LINK into source Link Pool");
    await tx.wait()
    tx = await sourceEthPool.connect(alice).depositNative({ value: 1000n * 10n ** 18n });
    console.log("Deposited 1000 ETH into source ETH Pool");
    await tx.wait()

    const beforeETHBalance = await hre.ethers.provider.getBalance(alice.address);
    const beforeLinkBalance = await sourcelinkToken.balanceOf(alice.address);

    console.log("Current ETH balance:", beforeETHBalance.toString());
    console.log("Current LINK balance:", beforeLinkBalance.toString());

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


    const loanReceipt = await tx.wait();

    const loanMsg = getEvm2EvmMessage(loanReceipt);
    console.log("EVM2EVM message:", loanMsg);

    const message =  {
        sourceChainSelector: 16015286601757825753n,
        sender: '0xFC6CaDb571f8F71cF1c6277B0b5fDE90555f2F8f',
        receiver: '0x34d9B6eD9E6bcc09742643Ec73126BAEdfff1Cf6',
        sequenceNumber: 6824n,
        gasLimit: 200000n,
        strict: false,
        nonce: 1n,
        feeToken: '0x779877A7B0D9E8603169DdbD7836e478b4624789',
        feeTokenAmount: 48366694124408740n,
        data: '0x0000000000000000000000000000000000000000000000000000000000007a690000000000000000000000000000000000000000000000000000000000000001000000000000000000000000f39fd6e51aad88f6f4ce6ab8827279cfffb9226600000000000000000000000000000000000000000000000000000000000000e00000000000000000000000000000000000000000000000000000000000000120000000000000000000000000d20b4c69c173d83567de947e9c0dfeedc95fe06d00000000000000000000000000000000000000000000000000000000000001600000000000000000000000000000000000000000000000000000000000000001000000000000000000000000779877a7b0d9e8603169ddbd7836e478b46247890000000000000000000000000000000000000000000000000000000000000001000000000000000000000000000000000000000000000002b5e3af16b188000000000000000000000000000000000000000000000000000000000000000000010000000000000000000000000000000000000000000000008ac7230489e80000',
        tokenAmounts: [],
        destTokenAmounts: [],
        sourceTokenData: [],
        messageId: '0x9ac3d58f4192d9a48b726978b9a306554065d38d7f81485251a85947e46d261a'
    }

    await sourceLinkPort.ccipReceive1(message)

    const afterETHBalance = await hre.ethers.provider.getBalance(alice.address);
    const afterLinkBalance = await sourcelinkToken.balanceOf(alice.address);

    console.log("After ETH balance:", afterETHBalance.toString());
    console.log("After LINK balance:", afterLinkBalance.toString());

    tx = await sourcelinkToken.connect(alice).approve(sourceLinkPool.target, 10n * 10n ** 18n);
    await tx.wait();
    console.log("Approved 10 LINK for repayment");

    tx = await sourceLinkPort.repay(destinationChainSelector, sourceWETH.target, [sourcelinkTokenAddress], [10n * 10n ** 18n]);
    const receipt = await tx.wait();
    const repayMsg1 = getEvm2EvmMessage(receipt);
    console.log("EVM2EVM message:", repayMsg1);

    const repayMsg =  {
        sourceChainSelector: 16015286601757825753n,
        sender: '0xFC6CaDb571f8F71cF1c6277B0b5fDE90555f2F8f',
        receiver: '0x34d9B6eD9E6bcc09742643Ec73126BAEdfff1Cf6',
        sequenceNumber: 6825n,
        gasLimit: 200000n,
        strict: false,
        nonce: 1n,
        feeToken: '0x779877A7B0D9E8603169DdbD7836e478b4624789',
        feeTokenAmount: 49472273547665396n,
        data: '0x0000000000000000000000000000000000000000000000000000000000007a690000000000000000000000000000000000000000000000000000000000000002000000000000000000000000f39fd6e51aad88f6f4ce6ab8827279cfffb9226600000000000000000000000000000000000000000000000000000000000000e00000000000000000000000000000000000000000000000000000000000000120000000000000000000000000d20b4c69c173d83567de947e9c0dfeedc95fe06d00000000000000000000000000000000000000000000000000000000000001600000000000000000000000000000000000000000000000000000000000000001000000000000000000000000779877a7b0d9e8603169ddbd7836e478b462478900000000000000000000000000000000000000000000000000000000000000010000000000000000000000000000000000000000000000008ac7230489e8000000000000000000000000000000000000000000000000000000000000000000010000000000000000000000000000000000000000000000001bc16cf12df79103',
        tokenAmounts: [],
        destTokenAmounts: [],
        sourceTokenData: [],
        messageId: '0xd5a81ba3ad56edbd3b05d34d79f85ce5bfa7661a1c3790878755049d5dcd02eb'
    }

    await sourceLinkPort.ccipReceive1(repayMsg);

    //await routeMessage(sourceRouterAddress, evm2EvmMessage);



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
