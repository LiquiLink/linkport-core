import { expect } from "chai";
import hre from "hardhat";
import { ethers } from "hardhat";
import { id, AbiCoder } from "ethers";
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
    const [alice] = await ethers.getSigners();
    const [source, destination] = ["ethereumSepolia", "arbitrumSepolia"];

    // Setup addresses and contracts
    const sourcelinkTokenAddress = getLINKTokenAddress(source);
    const destlinkTokenAddress = getLINKTokenAddress(destination);
    const sourceRouterAddress = getRouterConfig(source).address;
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

    // Deploy LinkPort on both chains (simulate)
    const linkPortFactory = await hre.ethers.getContractFactory("LinkPort");
    const sourceLinkPort = await linkPortFactory.deploy(
      alice.address, // dummy PoolFactory
      sourceRouterAddress,
      sourcelinkTokenAddress
    );
    await sourceLinkPort.deployed();

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

    const destinationLinkPort = await linkPortFactory.deploy(
      alice.address, // dummy PoolFactory
      destinationRouterAddress,
      destlinkTokenAddress,
    );
    await destinationLinkPort.deployed();

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
    console.log("Source LinkPort deployed at:", sourceLinkPort.address);


    // Register port addresses for cross-chain messaging
    await sourceLinkPort.setPort(destinationChainSelector, destinationLinkPort.address);

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

    await destinationLinkPort.setPort(getRouterConfig(source).chainSelector, sourceLinkPort.address);

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

    const poolFactoryFactory = await hre.ethers.getContractFactory("PoolFactory");
    const sourcePoolFactory = await poolFactoryFactory.deploy();
    await sourcePoolFactory.deployed();

    const feeRate = 50; // 0.5%
    const tx1 = await sourcePoolFactory.createPool(
      sourceLinkPort.address,
      sourcelinkTokenAddress,
      feeRate
    );
    await tx1.wait();
    const tx3 = await sourcePoolFactory.createPool(
      sourceLinkPort.address,
      '0x0000000000000000000000000000000000000000', 
      feeRate
    );
    await tx3.wait();
    const sourceLinkPoolAddress = await sourcePoolFactory.getPoolAddress(sourcelinkTokenAddress);
    const sourceEthPoolAddress = await sourcePoolFactory.getPoolAddress('0x0000000000000000000000000000000000000000');
    console.log("Source Link Pool deployed at:", sourceLinkPoolAddress);
    console.log("Source ETH Pool deployed at:", sourceEthPoolAddress);

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

    const destPoolFactoryFactory = await hre.ethers.getContractFactory("PoolFactory");
    const LiquidityPoolFactory = await hre.ethers.getContractFactory("LiquidityPool");
    const destPoolFactory = await destPoolFactoryFactory.deploy();
    await destPoolFactory.deployed();

    const tx2 = await destPoolFactory.createPool(
      destinationLinkPort.address,
      destlinkTokenAddress,
      feeRate
    );
    await tx2.wait();

    const tx4 = await destPoolFactory.createPool(
      destinationLinkPort.address,
      '0x0000000000000000000000000000000000000000', 
      feeRate
    );
    await tx4.wait();
    const destLinkPoolAddress = await destPoolFactory.getPoolAddress(destlinkTokenAddress);
    const destEthPoolAddress = await destPoolFactory.getPoolAddress('0x0000000000000000000000000000000000000000');
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

    // Prepare LINK for CCIP fee
    const linkTokenFactory = await hre.ethers.getContractFactory("TToken");
    const linkToken = linkTokenFactory.attach(sourcelinkTokenAddress)
    await requestLinkFromTheFaucet(sourcelinkTokenAddress, alice.address, 100n * 10n ** 18n);
    await linkToken.connect(alice).transfer(sourceLinkPort.address, 10n * 10n ** 18n);

    const sourceLinkPool = await LiquidityPoolFactory.attach(sourceLinkPoolAddress);
    const sourceEthPool = await LiquidityPoolFactory.attach(sourceEthPoolAddress);

    let tx ;
    tx = await linkToken.connect(alice).approve(sourceLinkPort.address, 100n * 10n ** 18n);
    await tx.wait();
    tx = await sourceLinkPool.connect(alice).deposit(100n * 10n ** 18n);
    console.log("Deposited 100 LINK into source Link Pool");
    await tx.wait()
    tx = await sourceEthPool.connect(alice).deposit(100n * 10n ** 18n);
    console.log("Deposited 100 ETH into source ETH Pool");
    await tx.wait()

    
    return;

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

  });
})
