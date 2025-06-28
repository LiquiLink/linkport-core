// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "./PoolFactory.sol";
import "./LiquidityPool.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@chainlink/contracts/src/v0.8/shared/interfaces/AggregatorV3Interface.sol";
import {LinkTokenInterface} from "@chainlink/contracts/src/v0.8/shared/interfaces/LinkTokenInterface.sol";
import {IRouterClient} from "@chainlink/contracts-ccip/contracts/interfaces/IRouterClient.sol";
import { CCIPReceiver } from "@chainlink/contracts-ccip/contracts/applications/CCIPReceiver.sol";
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

contract LinkPort is CCIPReceiver , Ownable{
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

    constructor(
        address _factory,
        address _ccipRouter,
        address _link
    ) Ownable() CCIPReceiver(_ccipRouter) {
        factory = PoolFactory(_factory);
        ccipRouter = IRouterClient(_ccipRouter);
        link = _link;
    }   

    function setPriceFeed(address token, address feed) external {
        // Only owner, add modifier as needed
        priceFeeds[token] = feed;
    }

    function setPort(uint256 chainId, address port) external onlyOwner {
        ports[chainId] = port;
    }

    function setToken(address token, uint256 chainId, address _token) external onlyOwner {
        // Only owner, add modifier as needed
        tokenList[token][chainId] = _token;
    }

    function setTokenPrice(address token, uint256 price) external onlyOwner {
        // Only owner, add modifier as needed
        tokenPrice[token] = price;
    }

    function getTokenPrice(address token) public view returns (uint8, uint256 price) {
        // only for mock or test, in production use Chainlink price feeds
        if (tokenPrice[token] > 0) {
            return (8, tokenPrice[token]);
        }
        AggregatorV3Interface feed = AggregatorV3Interface(priceFeeds[token]);
        (, int256 answer,,,) = feed.latestRoundData();
        uint8 decimals = feed.decimals();
        require(answer > 0, "Invalid price");
        return (decimals, uint256(answer));
    }

    function setInterestRate(address token, uint256 intrestRate) external {
        // Only owner, add modifier as needed
        LiquidityPool pool = LiquidityPool(payable(factory.getPool(token)));
        require(address(pool) != address(0), "Pool not found");
        pool.setInterestRate(intrestRate);
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

        IERC20(collateralToken).transferFrom(msg.sender, address(this), collateralAmount);

        // Approve Uniswap router to spend collateralToken
        IERC20(collateralToken).approve(uniswapV2Router, collateralAmount);

        address[] memory destTokens = new address[](tokens.length);
        uint256[] memory destAmounts = new uint256[](tokens.length);

        for (uint256 i = 0; i < tokens.length; i++) {
            uint256 sellAmount = (collateralAmount * shares[i]) / totalShares;
            if (sellAmount == 0) continue;
            if (collateralToken != tokens[i]) {
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
                destAmounts[i] = amounts[amounts.length - 1];
            } else {
                destAmounts[i] = sellAmount; // No swap needed, just use collateral amount
            }
            destTokens[i] = tokenList[tokens[i]][chainId];
        }

        sendCCIPMsg(chainId, 3, msg.sender, destTokens, destAmounts, collateralToken, new uint256[](0), 0);
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
        address[] calldata borrowTokens,
        uint256[] calldata borrowAmounts,
        uint256[] calldata collateralAmount 
    ) external {
        require(borrowTokens.length == borrowAmounts.length, "Length mismatch");

        (uint8 decimals, uint256 collateralPrice) = getTokenPrice(collateralToken);

        uint256[] memory tokenCollateralAmount = new uint256[](borrowTokens.length);

        uint256 totalAmount = 0;
        for (uint256 i = 0; i < collateralAmount.length; i++) {
            totalAmount += collateralAmount[i];
        }

        uint256 collateralValue = totalAmount * collateralPrice / (10 ** decimals);

        LiquidityPool pool = LiquidityPool(payable(factory.getPool(collateralToken)));

        uint256 userPosition = pool.getUserPosition(msg.sender);

        if (userPosition < totalAmount) {
            IERC20(collateralToken).transferFrom(msg.sender, address(this), totalAmount - userPosition);
        }

        pool.lock(msg.sender, totalAmount);

        // 6. Send CCIP message to target chain (pseudo-code)
        sendCCIPMsg(chainId, 1, msg.sender, borrowTokens, borrowAmounts, collateralToken, tokenCollateralAmount, collateralValue);
    }

    function repay(uint64 chainId, address collateralToken, address[] calldata tokens, uint256[] calldata amounts) external {
        uint256[] memory tokenCollateralAmount = new uint256[](tokens.length);
        for (uint256 i = 0; i < tokens.length; i++) {
            LiquidityPool pool = LiquidityPool(payable(factory.getPool(tokens[i])));
            require(address(pool) != address(0), "Pool not found");
            uint256 beforeCollateralAmount = pool.getLoanCollateralAmount(msg.sender, chainId, collateralToken);
            pool.repayFor(chainId, collateralToken, msg.sender, amounts[i]);
            uint256 afterCollateralAmount = pool.getLoanCollateralAmount(msg.sender, chainId, collateralToken);
            tokenCollateralAmount[i] = beforeCollateralAmount - afterCollateralAmount;
        }
        sendCCIPMsg(chainId, 2, msg.sender, tokens, amounts, collateralToken, tokenCollateralAmount, 0);
    }

    function repayAll(uint64 chainId, address collateralToken, address[] calldata tokens) external {
        uint256[] memory tokenCollateralAmount = new uint256[](tokens.length);
        uint256[] memory amounts = new uint256[](tokens.length);
        for (uint256 i = 0; i < tokens.length; i++) {
            LiquidityPool pool = LiquidityPool(payable(factory.getPool(tokens[i])));
            require(address(pool) != address(0), "Pool not found");
            uint256 beforeCollateralAmount = pool.getLoanCollateralAmount(msg.sender, chainId, collateralToken);
            amounts[i] = pool.getUserInterest(msg.sender, chainId, collateralToken);
            pool.repayFor(chainId, collateralToken, msg.sender, amounts[i]);
            uint256 afterCollateralAmount = pool.getLoanCollateralAmount(msg.sender, chainId, collateralToken);
            tokenCollateralAmount[i] = beforeCollateralAmount - afterCollateralAmount;
        }
        sendCCIPMsg(chainId, 2, msg.sender, tokens, amounts, collateralToken, tokenCollateralAmount, 0);
    }


    function sendCCIPMsg(
        uint64 chainId,
        uint256 msgType, // 1 loan, 2 repay, 3  repayFor
        address user,
        address[] memory tokens,
        uint256[] memory amounts,
        address collateralToken,
        uint256[] memory collateralAmount,
        uint256 collateralValue
    ) internal {

        // Encode your payload
        bytes memory payload = abi.encode(msgType, user, tokens, amounts, collateralToken, collateralAmount, collateralValue);

        address port = ports[chainId];

        // Build EVM2AnyMessage struct
        Client.EVM2AnyMessage memory message = Client.EVM2AnyMessage({
            receiver: abi.encode(port), // or remote LinkPort address
            data: payload,
            tokenAmounts: new Client.EVMTokenAmount[](0), // no token transfer
            extraArgs: Client._argsToBytes(
                Client.EVMExtraArgsV1({gasLimit: 1_000_000}) // Additional arguments, setting gas limit and non-strict sequency mode
            ),
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

    function _ccipReceive(Client.Any2EVMMessage memory message) internal override {
        // Decode the payload
        (uint256 msgType, address user, address[] memory tokens, uint256[] memory amount, address collateralToken, uint256[] memory tokenCollateralAmount, uint256 collateralValue) = abi.decode(message.data, (uint256, address, address[], uint256[], address, uint256[], uint256));

        if (msgType == 1) {
            require(tokens.length == amount.length, "Length mismatch");
            uint256 tokenValues = 0;

            for (uint256 i = 0; i < tokens.length; i++) {
                (uint8 decimals, uint256 price) = getTokenPrice(tokens[i]);
                tokenValues += price * amount[i] / (10 ** decimals);
            }

            if (tokenValues * 100 > collateralValue * 90) {
                sendCCIPMsg(
                    message.sourceChainSelector,
                    4, // Reject message type
                    user,
                    tokens,
                    amount,
                    collateralToken,
                    tokenCollateralAmount,
                    collateralValue
                );
                // reject loan if token values exceed 90% of collateral value
                return;
            }

            for (uint256 i = 0; i < tokens.length; i++) {
                LiquidityPool pool = LiquidityPool(payable(factory.getPool(tokens[i])));
                pool.loanTo(message.sourceChainSelector, collateralToken, tokenCollateralAmount[i], user, amount[i]);
                emit TokenLoan(user, tokens[i], amount[i]);
            }
        } else if (msgType == 2) {
            require(tokens.length == amount.length, "Length mismatch");
            LiquidityPool pool = LiquidityPool(payable(factory.getPool(collateralToken)));
            uint256 totalAmount = 0;
            for (uint256 i = 0; i < tokens.length; i++) {
                totalAmount += tokenCollateralAmount[i];
            }
            pool.unlock(user, totalAmount);
        } else if (msgType == 3) {
            require(tokens.length == amount.length, "Length mismatch");
            for (uint256 i = 0; i < tokens.length; i++) {
                LiquidityPool pool = LiquidityPool(payable(factory.getPool(tokens[i])));
                pool.portWithdraw(user, amount[i]);
            }
        } else if (msgType == 4) {
            //_ccipReceive(message); // Handle rejection logic if needed
            LiquidityPool pool = LiquidityPool(payable(factory.getPool(collateralToken)));
            uint256 totalAmount = 0 ;
            for (uint256 i = 0; i < tokens.length; i++) {
                totalAmount += tokenCollateralAmount[i];
            }
            pool.unlock(user, totalAmount);
        } else {
            revert("Unknown message type");
        }
    }
}
