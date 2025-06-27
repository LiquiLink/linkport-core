// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "./PoolFactory.sol";
import "./LiquidityPool.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@chainlink/contracts/src/v0.8/interfaces/AggregatorV3Interface.sol";
import {LinkTokenInterface} from "@chainlink/contracts/src/v0.8/interfaces/LinkTokenInterface.sol";
import {IRouterClient} from "@chainlink/contracts-ccip/contracts/interfaces/IRouterClient.sol";
import {IAny2EVMMessageReceiver} from "@chainlink/contracts-ccip/contracts/interfaces/IAny2EVMMessageReceiver.sol";
import {Client} from "@chainlink/contracts-ccip/contracts/libraries/Client.sol";

// UniswapV2 Router interface
interface IUniswapV2Router {
    function swapExactTokensForTokens(
        uint amountIn,
        uint amountOutMin,
        address[] calldata path,
        address to,
        uint deadline
    ) external returns (uint[] memory amounts);
}

contract LinkPort is IAny2EVMMessageReceiver, Ownable{
    PoolFactory public factory;
    IRouterClient public ccipRouter;
    address public link;

    // Mapping for Chainlink price feeds
    mapping(address => address) public priceFeeds;

    mapping(uint256 => address) public ports;

    mapping(address => uint256) public tokenPrice;

    // Store the result of collateralToken sold into tokens for each chainId
    mapping(uint256 => mapping(address => uint256)) public bridgeTokenAmounts;

    mapping(address => mapping(uint256 => address)) public tokenList;

    event TokenLoan(address indexed user, address indexed token, uint256 amount);

    address public uniswapV2Router; // Set this in constructor or via setter

    function setPriceFeed(address token, address feed) external {
        // Only owner, add modifier as needed
        priceFeeds[token] = feed;
    }

    function setPort(uint256 chainId, address port) external onlyOwner {
        ports[chainId] = port;
    }

    function setTokenPrice(address token, uint256 price) external onlyOwner {
        // Only owner, add modifier as needed
        tokenPrice[token] = price;
    }

    function getTokenPrice(address token) public view returns (uint256 price) {
        if (tokenPrice[token] > 0) {
            return tokenPrice[token];
        }
        AggregatorV3Interface feed = AggregatorV3Interface(priceFeeds[token]);
        (, int256 answer,,,) = feed.latestRoundData();
        require(answer > 0, "Invalid price");
        return uint256(answer);
    }


    function setUniswapV2Router(address router) external onlyOwner {
        uniswapV2Router = router;
    }

    function bridge(
        uint64 chainId,
        address collateralToken,
        uint256 collateralAmount,
        address[] calldata tokens,
        uint256[] calldata shares
    ) external {
        require(tokens.length == shares.length, "Length mismatch");
        require(collateralAmount > 0, "No collateral");
        require(uniswapV2Router != address(0), "Router not set");

        uint256 totalShares = 0;
        for (uint256 i = 0; i < shares.length; i++) {
            totalShares += shares[i];
        }
        require(totalShares > 0, "Total shares must be positive");

        // Approve Uniswap router to spend collateralToken
        IERC20(collateralToken).approve(uniswapV2Router, collateralAmount);

        address[] memory destTokens = new address[](tokens.length);
        uint256[] memory destAmounts = new uint256[](tokens.length);

        for (uint256 i = 0; i < tokens.length; i++) {
            uint256 sellAmount = (collateralAmount * shares[i]) / totalShares;
            if (sellAmount == 0) continue;

            address[] memory path = new address[](2);
            path[0] = collateralToken;
            path[1] = tokens[i];

            // Swap collateralToken to target token via UniswapV2
            uint[] memory amounts = IUniswapV2Router(uniswapV2Router).swapExactTokensForTokens(
                sellAmount,
                0, // Accept any amount out (for test/demo, use slippage control in prod)
                path,
                address(this),
                block.timestamp + 1200
            );
            destTokens[i] = tokenList[tokens[i]][chainId];
            destAmounts[i] = amounts[amounts.length - 1];

        }

        sendCCIPMsg(chainId, 3, msg.sender, destTokens, destAmounts, collateralToken, new uint256[](0));
    }

    function deposit(
        address token,
        uint256 amount 
    ) external {
        require(amount > 0, "Amount must be greater than zero");
        LiquidityPool pool = LiquidityPool(payable(factory.getPool(token)));
        pool.portDeposit(msg.sender, amount);
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

        uint256[] memory tokenCollateralAmount = new uint256[](borrowTokens.length);

        uint256 totalCollateralAmount = collateralAmount;
        for (uint256 i = 0; i < borrowTokens.length; i++) {
            uint256 price = getTokenPrice(borrowTokens[i]);
            uint256 tokenValue = borrowAmounts[i] * price;
            // Calculate collateral amount needed for this token
            tokenCollateralAmount[i] = (tokenValue * collateralAmount) / collateralValue;
            if (i == borrowTokens.length - 1) {
                tokenCollateralAmount[i] = totalCollateralAmount; // Last token takes all remaining collateral
            }
            totalCollateralAmount -= tokenCollateralAmount[i];
        }


        LiquidityPool pool = LiquidityPool(payable(factory.getPool(collateralToken)));
        pool.lock(msg.sender, collateralAmount);

        // 6. Send CCIP message to target chain (pseudo-code)
        sendCCIPMsg(chainId, 1, msg.sender, borrowTokens, borrowAmounts, collateralToken, tokenCollateralAmount);
    }

    function repay(uint64 chainId, address collateralToken, address[] calldata tokens, uint256[] calldata amounts) external {
        // Add access control as needed
        //chainId = 16015286601757825753;
        uint256[] memory tokenCollateralAmount = new uint256[](tokens.length);
        for (uint256 i = 0; i < tokens.length; i++) {
            LiquidityPool pool = LiquidityPool(payable(factory.getPool(tokens[i])));
            require(address(pool) != address(0), "Pool not found");
            uint256 beforeCollateralAmount = pool.getLoanCollateralAmount(msg.sender, chainId, collateralToken);
            pool.repayFor(chainId, collateralToken, msg.sender, amounts[i]);
            uint256 afterCollateralAmount = pool.getLoanCollateralAmount(msg.sender, chainId, collateralToken);
            tokenCollateralAmount[i] = beforeCollateralAmount - afterCollateralAmount;
        }
        //chainId = 3478487238524512106;
        sendCCIPMsg(chainId, 2, msg.sender, tokens, amounts, collateralToken, tokenCollateralAmount);
    }


    function sendCCIPMsg(
        uint64 chainId,
        uint256 msgType, // 1 loan, 2 repay, 3  repayFor
        address user,
        address[] memory tokens,
        uint256[] memory amounts,
        address collateralToken,
        uint256[] memory collateralAmount
    ) internal {

        // Encode your payload
        bytes memory payload = abi.encode(msgType, user, tokens, amounts, collateralToken, collateralAmount);

        address port = ports[chainId];

        // Build EVM2AnyMessage struct
        Client.EVM2AnyMessage memory message = Client.EVM2AnyMessage({
            receiver: abi.encode(port), // or remote LinkPort address
            data: payload,
            tokenAmounts: new Client.EVMTokenAmount[](0), // no token transfer
            extraArgs: "",
            feeToken: link // pay fee in native token
        });
        

        uint256 fee = ccipRouter.getFee(
            chainId,
            message
        );

        LinkTokenInterface(link).approve(address(ccipRouter), fee);

        // Estimate fee (optional)
        // (uint256 fee,) = ccipRouter.getFee(targetChainSelector, evm2AnyMsg);

        // Send the message
        ccipRouter.ccipSend(chainId, message);
    }

    function ccipReceive(Client.Any2EVMMessage calldata message) external {
        // Only allow calls from the CCIP router
        require(msg.sender == address(ccipRouter), "Not from router");
        // Decode the payload
        (uint256 msgType, address user, address[] memory tokens, uint256[] memory amount, address collateralToken, uint256[] memory tokenCollateralAmount) = abi.decode(message.data, (uint256, address, address[], uint256[], address, uint256[]));

        if (msgType == 1) {
            require(tokens.length == amount.length, "Length mismatch");
            for (uint256 i = 0; i < tokens.length; i++) {
                LiquidityPool pool = LiquidityPool(payable(factory.getPool(tokens[i])));
                pool.loanTo(message.sourceChainSelector, collateralToken, tokenCollateralAmount[i], user, amount[i]);
                emit TokenLoan(user, tokens[i], amount[i]);
            }
        } else if (msgType == 2) {
            require(tokens.length == amount.length, "Length mismatch");
            for (uint256 i = 0; i < tokens.length; i++) {
                LiquidityPool pool = LiquidityPool(payable(factory.getPool(collateralToken)));
                pool.unlock(user, tokenCollateralAmount[i]);
            }
        } else if (msgType == 3) {
            require(tokens.length == amount.length, "Length mismatch");
            for (uint256 i = 0; i < tokens.length; i++) {
                LiquidityPool pool = LiquidityPool(payable(factory.getPool(tokens[i])));
                pool.portWithdraw(user, amount[i]);
            }
        } else {
            revert("Unknown message type");
        }
    }
}
