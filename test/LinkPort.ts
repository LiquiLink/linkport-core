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
    const linkTokenAddress = getLINKTokenAddress(source);
    const sourceRouterAddress = getRouterConfig(source).address;
    const destinationRouterAddress = getRouterConfig(destination).address;
    const sourceCCIPBnMTokenAddress = getFaucetTokensAddresses(source).ccipBnM;
    const destinationCCIPBnMTokenAddress = getFaucetTokensAddresses(destination).ccipBnM;
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
      sourceRouterAddress
    );
    await sourceLinkPort.waitForDeployment();
    const destinationLinkPort = await linkPortFactory.deploy(
      alice.address, // dummy PoolFactory
      destinationRouterAddress
    );
    await destinationLinkPort.waitForDeployment();

    // Register port addresses for cross-chain messaging
    await sourceLinkPort.setPort(destinationChainSelector, await destinationLinkPort.getAddress());
    await destinationLinkPort.setPort(getRouterConfig(source).chainSelector, await sourceLinkPort.getAddress());

    // Setup token contract
    const ccipBnMFactory = await hre.ethers.getContractFactory("BurnMintERC677Helper");
    const sourceCCIPBnM = ccipBnMFactory.attach(sourceCCIPBnMTokenAddress) as BurnMintERC677Helper;
    const destinationCCIPBnM = ccipBnMFactory.attach(destinationCCIPBnMTokenAddress) as BurnMintERC677Helper;

    // Drip tokens to Alice
    await sourceCCIPBnM.connect(alice).drip(alice.address);

    // Approve LinkPort to lock collateral
    await sourceCCIPBnM.connect(alice).approve(await sourceLinkPort.getAddress(), 1000n);

    // Prepare LINK for CCIP fee
    const linkTokenFactory = await hre.ethers.getContractFactory("LinkToken");
    const linkToken = linkTokenFactory.attach(linkTokenAddress) as LinkTokenInterface;
    await requestLinkFromTheFaucet(linkTokenAddress, alice.address, 1n * 10n ** 18n);
    await linkToken.connect(alice).approve(sourceRouterAddress, 1n * 10n ** 18n);

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
});