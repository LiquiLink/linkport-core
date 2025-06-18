// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

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
        require(asset.balanceOf(user) >= amount, "Insufficient balance");
        locked[user] += amount;
        uint256 poolBalance = asset.balanceOf(address(this)) + totalLoans + totalAccruedInterest;
        uint256 shares = amount * (poolBalance / totalSupply());
        transferFrom(user, address(this), shares);
        emit Locked(user, shares, amount);
    }


    function deposit(uint256 amount) external {
        require(amount > 0, "Amount must be greater than zero");
        accrueInterest();
        uint256 poolBalance = asset.balanceOf(address(this)) + totalLoans + totalAccruedInterest;
        uint256 shares = totalSupply() == 0 ? amount : (amount * totalSupply()) / poolBalance;
        asset.transferFrom(msg.sender, address(this), amount);
        _mint(msg.sender, shares);
        emit Deposited(msg.sender, amount, shares);
    }

    function withdraw(uint256 shares) external {
        require(balanceOf(msg.sender) >= shares, "Not enough shares");
        accrueInterest();
        uint256 poolBalance = asset.balanceOf(address(this)) + totalLoans + totalAccruedInterest;
        uint256 amount = (shares * poolBalance) / totalSupply();
        _burn(msg.sender, shares);
        require(asset.balanceOf(address(this)) >= amount, "Insufficient liquidity");
        asset.transfer(msg.sender, amount);
        emit Withdrawn(msg.sender, amount, shares);
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
}