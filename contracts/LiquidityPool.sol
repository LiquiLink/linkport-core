// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";

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
    uint256 public portLoan = 0;
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
    event Loaned(address indexed user, uint256 amount);
    event Repaid(address indexed user, uint256 amount, uint256 interest);
    event Locked(address indexed user, uint256 shares, uint256 amount);
    event Unlock(address indexed user, uint256 shares, uint256 amount);
    event InterestRateChanged(address indexed pool, uint256 newRate);

    mapping(address => uint256) public lockedShares; 
    mapping(address => uint256) public lockedAmount; 

    address public immutable factory;
    address public port;

    constructor(address _port, address _asset, uint256 _feeRate) ERC20("LiquidityPool Token", "LPT") {
        asset = IERC20(_asset);
        feeRate = _feeRate;
        interestRate = 2000; // 20%
        lastAccrual = block.timestamp;
        factory = msg.sender;
        port = _port; 
    }

    function setInterestRate(uint256 newRate) external /* onlyOwner or other access control */ {
        require(newRate > 0, "Interest rate must be greater than zero");
        require(msg.sender == port, "Only port can set interest rate");
        accrueInterest();
        interestRate = newRate;
        emit InterestRateChanged(address(this), newRate);
    }

    function getLoanCollateralAmount(address user, uint256 chainId, address token) external view returns (uint256) {
        return loans[user][chainId][token].tokenAmount;
    }

    // Called before every deposit/withdraw/loan/repay to update pool state
    function accrueInterest() public {
        uint256 elapsed = block.timestamp - lastAccrual;
        if (elapsed == 0 || totalLoans == 0) {
            return;
        }
        // Linear interest accrual: principal * rate * time / (10000 * 365 days)
        uint256 interest = (totalLoans * interestRate * elapsed) / (10000 * 365 * 86400 );
        totalAccruedInterest += interest;
        lastAccrual = block.timestamp;
    }

    function getPoolBalance() public view returns (uint256) {
        return asset.balanceOf(address(this)) + totalLoans + totalAccruedInterest + portLoan;
    }

    function getUserPosition(address user) external view returns (uint256 amount) {
        uint256 shares = balanceOf(user);
        uint256 poolBalance = getPoolBalance();
        amount = (shares * poolBalance) / totalSupply();
    }

    function lock(address user, uint256 amount) external {
        require(msg.sender == port, "Only port can lock collateral");
        require(amount > 0, "Amount must be greater than zero");
        uint256 poolBalance = getPoolBalance();
        uint256 shares = amount * poolBalance / totalSupply();
        require(shares <= balanceOf(user), "Insufficient shares for locking");
        _transfer(user, address(this), shares);
        lockedAmount[user] += amount;
        lockedShares[user] += shares;
        emit Locked(user, shares, amount);
    }

    function unlock(address user, uint256 amount) external {
        require(msg.sender == port, "Only port can lock collateral");
        require(amount > 0, "Amount must be greater than zero");
        require(lockedAmount[user] >= amount, "Insufficient locked amount");
        uint256 shares = amount * lockedShares[user] / lockedAmount[user];
        _transfer(address(this), user, shares);
        lockedAmount[user] -= amount;
        lockedShares[user] -= shares;
        emit Unlock(user, shares, amount);
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

        uint256 poolBalance = getPoolBalance();
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

        uint256 poolBalance = getPoolBalance();
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

        // If a loan record exists, calculate and accumulate existing interest, and reset startTime
        if (loan.amount > 0) {
            uint256 elapsed = block.timestamp - loan.startTime;
            if (elapsed > 0) {
                uint256 accrued = (loan.amount * interestRate * elapsed) / (10000 * 365 * 86400);
                loan.interest += accrued;
            }
            loan.startTime = block.timestamp;
            loan.tokenAmount += tokenAmount;
            loan.amount += amount;
        } else {
            loans[to][chainId][token] = Loan(tokenAmount, amount, 0, block.timestamp);
        }

        totalLoans += amount;
        asset.transfer(to, amount);
        emit Loaned(to, amount);
    }

    function getUserInterest(address user, uint256 chainId, address token) external view returns (uint256) {
        Loan storage loan = loans[user][chainId][token];
        if (loan.amount == 0) {
            return 0;
        }
        uint256 elapsed = block.timestamp - loan.startTime;
        uint256 accrued = (loan.amount * interestRate * elapsed) / (10000 * 365 * 86400);
        return loan.interest + accrued;
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
                uint256 accrued = (loan.amount * interestRate * elapsed) / (10000 * 86400 * 365);
                loan.interest += accrued;
                loan.startTime = block.timestamp;
            }
        }

        uint256 totalOwed = loan.amount + loan.interest;
        require(totalOwed > 0, "No debt to repay");
        require(amount <= totalOwed, "Repay amount exceeds debt");

        // Repay interest first, then principal
        uint256 interestPaid = amount > loan.interest ? loan.interest : amount;
        uint256 principalPaid = amount > loan.interest ? amount - loan.interest : 0;

        loan.interest -= interestPaid;
        if (principalPaid > 0) {
            uint256 tokenAmount = loan.tokenAmount * principalPaid / loan.amount; // Adjust token amount proportionally
            loan.amount -= principalPaid;
            totalLoans -= principalPaid;
            loan.tokenAmount -= tokenAmount;
        }

        /*
        // Fee is only charged on the interest paid
        uint256 fee = (interestPaid * feeRate) / 10000;
        if (fee > 0) {
            asset.transferFrom(from, factory, fee);
            totalAccruedInterest -= fee;
        }
        // The remaining portion goes to the pool
        uint256 poolPortion = amount - fee;
        asset.transferFrom(from, address(this), poolPortion);
        */

        emit Repaid(from, principalPaid, interestPaid);
    }

    function portWithdraw(address to, uint256 amount) external {
        require(msg.sender == port, "Only port can withdraw");
        require(amount > 0, "Amount must be greater than zero");
        require(asset.balanceOf(address(this)) >= amount, "Insufficient pool balance");

        portLoan += amount;
        asset.transfer(to, amount);
    }

    function portDeposit(address from, uint256 amount) external {
        require(amount > 0, "Amount must be greater than zero");

        asset.transferFrom(from, address(this), amount);
        portLoan -= amount;
    }

    /// @notice Allow contract to receive native token
    receive() external payable {}
}