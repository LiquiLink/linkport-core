// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "./PoolFactory.sol";
import "./LiquidityPool.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@chainlink/contracts/src/v0.8/interfaces/AggregatorV3Interface.sol";
import {IRouterClient} from "@chainlink/contracts-ccip/contracts/interfaces/IRouterClient.sol";
import {IAny2EVMMessageReceiver} from "@chainlink/contracts-ccip/contracts/interfaces/IAny2EVMMessageReceiver.sol";
import {Client} from "@chainlink/contracts-ccip/contracts/libraries/Client.sol";

contract LinkPort is IAny2EVMMessageReceiver, Ownable{
    PoolFactory public factory;
    IRouterClient public ccipRouter;

    // Mapping for Chainlink price feeds
    mapping(address => address) public priceFeeds;

    mapping(uint256 => address) public ports;

    event TokenLoan(address indexed user, address indexed token, uint256 amount);
    event PortSet(uint256 indexed chainId, address indexed port);

    constructor(address _factory, address _ccipRouter) Ownable() {
        factory = PoolFactory(_factory);
        ccipRouter = IRouterClient(_ccipRouter);
    }

    function setPriceFeed(address token, address feed) external {
        // Only owner, add modifier as needed
        priceFeeds[token] = feed;
    }

    function setPort(uint256 chainId, address port) external onlyOwner {
        ports[chainId] = port;
        emit PortSet(chainId, port);
    }

    function getTokenPrice(address token) public view returns (uint256 price) {
        AggregatorV3Interface feed = AggregatorV3Interface(priceFeeds[token]);
        (, int256 answer,,,) = feed.latestRoundData();
        require(answer > 0, "Invalid price");
        return uint256(answer);
    }

    function loan(
        uint64 chainId,
        address collateralToken,
        uint256 collateralAmount,
        address[] calldata borrowTokens,
        uint256[] calldata borrowAmounts
    ) external {
        require(borrowTokens.length == borrowAmounts.length, "Length mismatch");

        // 1. Check collateral value
        uint256 collateralPrice = getTokenPrice(collateralToken);
        uint256 collateralValue = collateralAmount * collateralPrice;

        // 2. Check total borrow value
        uint256 totalBorrowValue = 0;
        for (uint256 i = 0; i < borrowTokens.length; i++) {
            uint256 price = getTokenPrice(borrowTokens[i]);
            totalBorrowValue += borrowAmounts[i] * price;
        }

        // 3. Ensure LTV ≤ 80%
        require(totalBorrowValue * 100 <= collateralValue * 80, "Exceeds LTV");

        address payable collateralPool = payable(factory.getPool(collateralToken));
        LiquidityPool pool = LiquidityPool(collateralPool);
        pool.lock(msg.sender, collateralAmount);

        // 6. Send CCIP message to target chain (pseudo-code)
        sendCCIPLoanMsg(chainId, 1, msg.sender, borrowTokens, borrowAmounts, collateralToken, collateralAmount);
    }

    function repay(uint64 chainId, address token, uint256 amount) external {
        // Add access control as needed
        address payable poolAddress = payable(factory.getPool(token));
        LiquidityPool pool = LiquidityPool(poolAddress);
        require(address(pool) != address(0), "Pool not found");
        pool.repayFor(chainId, token,  msg.sender, amount);
        address[] memory tokens = new address[](1);
        tokens[0] = token;
        uint256[] memory amounts = new uint256[](1);
        amounts[0] = amount;
        sendCCIPRepayMsg(chainId, 2, msg.sender, tokens, amounts);
    }

    function sendCCIPRepayMsg(
        uint64 chainId,
        uint256 msgType, // 1 loan, 2 repay, 3 repayFor
        address user,
        address[] memory tokens,
        uint256[] memory amounts
    ) internal {

        // Encode your payload
        bytes memory payload = abi.encode(block.chainid, msgType, user, tokens, amounts);

        address port = ports[chainId];

        // Build EVM2AnyMessage struct
        Client.EVM2AnyMessage memory evm2AnyMsg = Client.EVM2AnyMessage({
            receiver: abi.encode(port), // or remote LinkPort address
            data: payload,
            tokenAmounts: new Client.EVMTokenAmount[](0), // no token transfer
            extraArgs: "",
            feeToken: address(0) // pay fee in native token
        });

        // Estimate fee (optional)
        // (uint256 fee,) = ccipRouter.getFee(targetChainSelector, evm2AnyMsg);

        // Send the message
        ccipRouter.ccipSend{value: msg.value}(chainId, evm2AnyMsg);
    }

    function sendCCIPLoanMsg(
        uint64 chainId,
        uint256 msgType, // 1 loan, 2 repay, 3  repayFor
        address user,
        address[] memory tokens,
        uint256[] memory amounts,
        address collateralToken,
        uint256 collateralAmount
    ) internal {

        // Encode your payload
        bytes memory payload = abi.encode(block.chainid, msgType, user, tokens, amounts, collateralToken, collateralAmount);

        address port = ports[chainId];

        // Build EVM2AnyMessage struct
        Client.EVM2AnyMessage memory evm2AnyMsg = Client.EVM2AnyMessage({
            receiver: abi.encode(port), // or remote LinkPort address
            data: payload,
            tokenAmounts: new Client.EVMTokenAmount[](0), // no token transfer
            extraArgs: "",
            feeToken: address(0) // pay fee in native token
        });

        // Estimate fee (optional)
        // (uint256 fee,) = ccipRouter.getFee(targetChainSelector, evm2AnyMsg);

        // Send the message
        ccipRouter.ccipSend{value: msg.value}(chainId, evm2AnyMsg);
    }

    function ccipReceive(Client.Any2EVMMessage calldata message) external override {
        // Only allow calls from the CCIP router
        require(msg.sender == address(ccipRouter), "Not from router");

        // Decode the payload
        (uint256 chainId, uint256 msgType, address user, address[] memory tokens, uint256[] memory amount, address collateralToken, uint256 collateralAmount) = abi.decode(message.data, (uint256, uint256, address, address[], uint256[], address, uint256));

        if (msgType == 1) {
            require(tokens.length == amount.length, "Length mismatch");
            for (uint256 i = 0; i < tokens.length; i++) {
                LiquidityPool pool = LiquidityPool(payable(factory.getPool(tokens[i])));
                pool.loanTo(chainId, collateralToken, collateralAmount, user, amount[i]);
                emit TokenLoan(user, tokens[i], amount[i]);
            }
        } else if (msgType == 2) {
            require(tokens.length == amount.length, "Length mismatch");
            for (uint256 i = 0; i < tokens.length; i++) {
                // Optionally unlock collateral here
                //unlockCollateral(user, amount[i]);
            }
        } else if (msgType == 3) {
            // Handle repay for logic
            // Decode and process repay for message
        } else {
            revert("Unknown message type");
        }
    }
}
