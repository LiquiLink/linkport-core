// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import "hardhat/console.sol";

interface IWETH is IERC20 {
    function deposit() external payable;
    function withdraw(uint256) external;
}

contract LiquidityPool is ERC20 {
    IERC20 public immutable asset;
    uint256 public feeRate; // basis points
    uint256 public totalLoans;
    uint256 public interestRate; // e.g. 2000 = 20%
    uint256 public lastAccrual;
    uint256 public totalAccruedInterest; // total accrued interest for all outstanding loans

    struct Loan {
        uint256 tokenAmount;
        uint256 amount;
        uint256 interest;
        uint256 startTime;
    }

    mapping(address => mapping(uint256 => mapping (address  => Loan))) public loans;

    event Deposited(address indexed user, uint256 amount, uint256 shares);
    event Withdrawn(address indexed user, uint256 amount, uint256 shares);
    event Loaned(address indexed user, uint256 amount, uint256 interest);
    event Repaid(address indexed user, uint256 amount, uint256 interest);
    event Locked(address indexed user, uint256 shares, uint256 amount);

    mapping(address => uint256) public locked; 

    address public immutable factory;
    address public port;

    constructor(address _port, address _asset, uint256 _feeRate) ERC20("PoolToken", "PTK") {
        asset = IERC20(_asset);
        feeRate = _feeRate;
        interestRate = 2000; // 20%
        lastAccrual = block.timestamp;
        factory = msg.sender;
        port = _port; 
    }

    // Called before every deposit/withdraw/loan/repay to update pool state
    function accrueInterest() public {
        uint256 elapsed = block.timestamp - lastAccrual;
        if (elapsed == 0 || totalLoans == 0) {
            return;
        }
        // Linear interest accrual: principal * rate * time / (10000 * 365 days)
        uint256 interest = (totalLoans * interestRate * elapsed) / (10000 * 365 days);
        totalAccruedInterest += interest;
        lastAccrual = block.timestamp;
    }

    function lock(address user, uint256 amount) external {
        require(msg.sender == port, "Only port can lock collateral");
        require(amount > 0, "Amount must be greater than zero");
        uint256 poolBalance = asset.balanceOf(address(this)) + totalLoans + totalAccruedInterest;
        uint256 shares = amount * poolBalance / totalSupply();
        require(shares <= balanceOf(user), "Insufficient shares for locking");
        console.log("user balance & shares ", user, balanceOf(user), shares);
        _transfer(user, address(this), shares);
        locked[user] += amount;
        emit Locked(user, shares, amount);
    }

    /// @notice Internal deposit logic for both ERC20 and native token
    function _deposit(address payer, uint256 amount, bool isNative) internal {
        require(amount > 0, "Amount must be greater than zero");
        accrueInterest();

        if (isNative) {
            // Wrap native token to WETH/WBNB
            IWETH(address(asset)).deposit{value: amount}();
        } else {
            asset.transferFrom(payer, address(this), amount);
        }

        uint256 poolBalance = asset.balanceOf(address(this)) + totalLoans + totalAccruedInterest;
        uint256 shares = totalSupply() == 0 ? amount : (amount * totalSupply()) / poolBalance;
        _mint(payer, shares);
        emit Deposited(payer, amount, shares);
    }

    /// @notice Deposit ERC20 token
    function deposit(uint256 amount) external {
        _deposit(msg.sender, amount, false);
    }

    /// @notice Deposit native token (ETH/BNB), automatically wrap to WETH/WBNB
    function depositNative() external payable {
        _deposit(msg.sender, msg.value, true);
    }

    /// @notice Internal withdraw logic for both ERC20 and native token
    function _withdraw(address to, uint256 shares, bool isNative) internal {
        require(balanceOf(msg.sender) >= shares, "Not enough shares");
        accrueInterest();

        uint256 poolBalance = asset.balanceOf(address(this)) + totalLoans + totalAccruedInterest;
        uint256 amount = (shares * poolBalance) / totalSupply();
        _burn(msg.sender, shares);
        require(asset.balanceOf(address(this)) >= amount, "Insufficient liquidity");

        if (isNative) {
            IWETH(address(asset)).withdraw(amount);
            (bool sent, ) = to.call{value: amount}("");
            require(sent, "Native transfer failed");
        } else {
            asset.transfer(to, amount);
        }
        emit Withdrawn(to, amount, shares);
    }

    /// @notice Withdraw ERC20 token
    function withdraw(uint256 shares) external {
        _withdraw(msg.sender, shares, false);
    }

    /// @notice Withdraw native token (ETH/BNB), automatically unwrap WETH/WBNB
    function withdrawNative(uint256 shares) external {
        _withdraw(msg.sender, shares, true);
    }

    function setPort(address _port) external /* onlyOwner or other access control */ {
        port = _port;
    }

    function loanTo(uint256 chainId,address token, uint256 tokenAmount, address to, uint256 amount) external {
        require(msg.sender == port, "Only port can call loanTo");
        accrueInterest();
        require(asset.balanceOf(address(this)) >= amount, "Insufficient pool");

        Loan storage loan = loans[to][chainId][token];
        uint256 interest = (amount * interestRate) / 10000;

        // If a loan record exists, calculate and accumulate existing interest, and reset startTime
        if (loan.amount > 0) {
            uint256 elapsed = block.timestamp - loan.startTime;
            if (elapsed > 0) {
                uint256 accrued = (loan.amount * interestRate * elapsed) / (10000 * 365 days);
                loan.interest += accrued;
            }
            loan.startTime = block.timestamp;
            loan.tokenAmount += tokenAmount;
            loan.amount += amount;
            loan.interest += interest;
        } else {
            loans[to][chainId][token] = Loan(tokenAmount, amount, interest, block.timestamp);
        }

        totalLoans += amount;
        asset.transfer(to, amount);
        emit Loaned(to, amount, interest);
    }

    function repayFor(uint256 chainId, address token, address from, uint256 amount) external {
        require(msg.sender == port, "Only port can call repayFrom");
        accrueInterest();

        Loan storage loan = loans[from][chainId][token];
        require(amount > 0, "Repay amount must be greater than zero");

        // Recalculate and accumulate interest before repayment
        if (loan.amount > 0) {
            uint256 elapsed = block.timestamp - loan.startTime;
            if (elapsed > 0) {
                uint256 accrued = (loan.amount * interestRate * elapsed) / (10000 * 365 days);
                loan.interest += accrued;
                loan.startTime = block.timestamp;
            }
        }

        uint256 totalOwed = loan.amount + loan.interest;
        require(amount <= totalOwed, "Repay amount exceeds debt");

        // Repay interest first, then principal
        uint256 interestPaid = amount > loan.interest ? loan.interest : amount;
        uint256 principalPaid = amount > loan.interest ? amount - loan.interest : 0;

        loan.interest -= interestPaid;
        if (principalPaid > 0) {
            loan.amount -= principalPaid;
            totalLoans -= principalPaid;
        }

        // Fee is only charged on the interest paid
        uint256 fee = (interestPaid * feeRate) / 10000;
        if (fee > 0) {
            asset.transferFrom(from, factory, fee);
            totalAccruedInterest -= fee;
        }
        // The remaining portion goes to the pool
        uint256 poolPortion = amount - fee;
        asset.transferFrom(from, address(this), poolPortion);

        emit Repaid(from, principalPaid, interestPaid);
    }

    /// @notice Allow contract to receive native token
    receive() external payable {}
}