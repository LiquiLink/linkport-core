// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "./PoolFactory.sol";
import "./LiquidityPool.sol";
import "@chainlink/contracts/src/v0.8/shared/interfaces/AggregatorV3Interface.sol";
import {IRouterClient} from "@chainlink/contracts-ccip/contracts/interfaces/IRouterClient.sol";
import {IAny2EVMMessageReceiver} from "@chainlink/contracts-ccip/contracts/interfaces/IAny2EVMMessageReceiver.sol";
import {Client} from "@chainlink/contracts-ccip/contracts/libraries/Client.sol";

contract LinkPort is IAny2EVMMessageReceiver {
    PoolFactory public factory;
    IRouterClient public ccipRouter;
    uint64 public targetChainSelector; // Set this for your destination chain

    // Mapping for Chainlink price feeds
    mapping(address => address) public priceFeeds;

    // user => token => amount
    mapping(address => mapping(address => uint256)) public lockedCollateral;

    constructor(address _factory, address _ccipRouter, uint64 _targetChainSelector) {
        factory = PoolFactory(_factory);
        ccipRouter = IRouterClient(_ccipRouter);
        targetChainSelector = _targetChainSelector;
    }

    function setPriceFeed(address token, address feed) external {
        // Only owner, add modifier as needed
        priceFeeds[token] = feed;
    }

    function getTokenPrice(address token) public view returns (uint256 price) {
        AggregatorV3Interface feed = AggregatorV3Interface(priceFeeds[token]);
        (, int256 answer,,,) = feed.latestRoundData();
        require(answer > 0, "Invalid price");
        return uint256(answer);
    }

    function loan(
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

        // 4. Lock collateral (transfer to this contract)
        IERC20(collateralToken).transferFrom(msg.sender, address(this), collateralAmount);
        lockedCollateral[msg.sender][collateralToken] += collateralAmount;

        // 5. Call loan on each pool
        for (uint256 i = 0; i < borrowTokens.length; i++) {
            address pool = factory.getPool(borrowTokens[i]);
            require(pool != address(0), "Pool not found");
            LiquidityPool(pool).loanTo(borrowAmounts[i]);
        }

        // 6. Send CCIP message to target chain (pseudo-code)
        sendCCIPMessage(msg.sender, borrowTokens, borrowAmounts);
    }

    // Example: unlock collateral (after repay or liquidation)
    function unlockCollateral(address user, address token, uint256 amount) external {
        // Add access control as needed
        require(lockedCollateral[user][token] >= amount, "Not enough locked");
        lockedCollateral[user][token] -= amount;
        IERC20(token).transfer(user, amount);
    }

    function sendCCIPMessage(
        address user,
        address[] memory tokens,
        uint256[] memory amounts
    ) internal {
        // Encode your payload
        bytes memory payload = abi.encode(user, tokens, amounts);

        // Build EVM2AnyMessage struct
        Client.EVM2AnyMessage memory evm2AnyMsg = Client.EVM2AnyMessage({
            receiver: abi.encode(address(this)), // or remote LinkPort address
            data: payload,
            tokenAmounts: new Client.EVMTokenAmount[](0), // no token transfer
            extraArgs: "",
            feeToken: address(0) // pay fee in native token
        });

        // Estimate fee (optional)
        // (uint256 fee,) = ccipRouter.getFee(targetChainSelector, evm2AnyMsg);

        // Send the message
        ccipRouter.ccipSend{value: msg.value}(targetChainSelector, evm2AnyMsg);
    }

    function ccipReceive(Client.Any2EVMMessage calldata message) external override {
        // Only allow calls from the CCIP router
        require(msg.sender == address(ccipRouter), "Not from router");

        // Decode the payload

        // Handle the cross-chain logic, e.g., mint tokens, update state, etc.
    }
}