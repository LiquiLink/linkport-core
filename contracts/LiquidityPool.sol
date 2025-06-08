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
        uint256 amount;
        uint256 interest;
        uint256 startTime;
        bool repaid;
    }
    mapping(address => Loan) public loans;

    event Deposited(address indexed user, uint256 amount, uint256 shares);
    event Withdrawn(address indexed user, uint256 amount, uint256 shares);
    event Loaned(address indexed user, uint256 amount, uint256 interest);
    event Repaid(address indexed user, uint256 amount, uint256 interest);

    address public immutable factory;

    constructor(address _asset, uint256 _feeRate) ERC20("PoolToken", "PTK") {
        asset = IERC20(_asset);
        feeRate = _feeRate;
        interestRate = 2000; // 20%
        lastAccrual = block.timestamp;
        factory = msg.sender;
    }

    // Called before every deposit/withdraw/loan/repay to update pool state
    function accrueInterest() public {
        uint256 elapsed = block.timestamp - lastAccrual;
        if (elapsed == 0 || totalLoans == 0) {
            lastAccrual = block.timestamp;
            return;
        }
        // Linear interest accrual: principal * rate * time / (10000 * 365 days)
        uint256 interest = (totalLoans * interestRate * elapsed) / (10000 * 365 days);
        totalAccruedInterest += interest;
        lastAccrual = block.timestamp;
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

    function loanTo(uint256 amount) external {
        accrueInterest();
        require(asset.balanceOf(address(this)) >= amount, "Insufficient pool");
        require(loans[msg.sender].amount == 0 || loans[msg.sender].repaid, "Outstanding loan exists");
        uint256 interest = (amount * interestRate) / 10000;
        loans[msg.sender] = Loan(amount, interest, block.timestamp, false);
        totalLoans += amount;
        asset.transfer(msg.sender, amount);
        emit Loaned(msg.sender, amount, interest);
    }

    function repayFrom(uint256 repayAmount) external {
        accrueInterest();
        Loan storage loan = loans[msg.sender];
        require(!loan.repaid, "Already repaid");
        require(repayAmount > 0, "Repay amount must be greater than zero");
        uint256 totalOwed = loan.amount + loan.interest;
        require(repayAmount <= totalOwed, "Repay amount exceeds debt");

        // Calculate how much is principal and how much is interest
        uint256 principalPaid;
        uint256 interestPaid;
        if (repayAmount <= loan.interest) {
            principalPaid = 0;
            interestPaid = repayAmount;
            loan.interest -= repayAmount;
        } else {
            interestPaid = loan.interest;
            principalPaid = repayAmount - loan.interest;
            loan.interest = 0;
            loan.amount -= principalPaid;
        }

        // Fee is only charged on the interest paid
        uint256 fee = (interestPaid * feeRate) / 10000;
        if (fee > 0) {
            asset.transferFrom(msg.sender, factory, fee);
            totalAccruedInterest -= fee;
        }
        // The rest goes to the pool
        uint256 poolPortion = repayAmount - fee;
        asset.transferFrom(msg.sender, address(this), poolPortion);

        // If fully repaid, mark as repaid and update totalLoans
        if (loan.amount == 0 && loan.interest == 0) {
            loan.repaid = true;
            totalLoans -= principalPaid;
        } else if (principalPaid > 0) {
            totalLoans -= principalPaid;
        }

        emit Repaid(msg.sender, principalPaid, interestPaid);
    }
}