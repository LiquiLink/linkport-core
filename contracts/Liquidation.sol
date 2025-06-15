// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@chainlink/contracts/src/v0.8/automation/AutomationCompatible.sol";
import "./LiquidityPool.sol";

contract Liquidation is AutomationCompatibleInterface {
    LiquidityPool public pool;
    address[] public borrowers;

    event Liquidated(address indexed borrower, uint256 amount);

    constructor(address _pool) {
        pool = LiquidityPool(_pool);
    }

    // Register a borrower (should be called when a new loan is issued)
    function registerBorrower(address borrower) external {
        // Only pool can call this
        require(msg.sender == address(pool), "Only pool");
        borrowers.push(borrower);
    }

    // Chainlink Automation-compatible checkUpkeep function
    function checkUpkeep(bytes calldata) external view override returns (bool upkeepNeeded, bytes memory performData) {
        for (uint256 i = 0; i < borrowers.length; i++) {
            LiquidityPool.Loan memory loan = pool.loans(borrowers[i]);
            // Example: if loan is overdue or undercollateralized, mark for liquidation
            if (loan.amount > 0 && _shouldLiquidate(borrowers[i], loan)) {
                upkeepNeeded = true;
                performData = abi.encode(borrowers[i]);
                return (upkeepNeeded, performData);
            }
        }
        upkeepNeeded = false;
        performData = "";
    }

    // Chainlink Automation-compatible performUpkeep function
    function performUpkeep(bytes calldata performData) external override {
        address borrower = abi.decode(performData, (address));
        LiquidityPool.Loan memory loan = pool.loans(borrower);
        require(loan.amount > 0, "No active loan");
        require(_shouldLiquidate(borrower, loan), "Not eligible for liquidation");

        // Call pool to liquidate the borrower's collateral (implement this in LiquidityPool)
        uint256 liquidatedAmount = _liquidate(borrower, loan);
        emit Liquidated(borrower, liquidatedAmount);
    }

    // Example liquidation logic (customize as needed)
    function _shouldLiquidate(address borrower, LiquidityPool.Loan memory loan) internal view returns (bool) {
        // Example: if loan is older than 30 days
        if (block.timestamp > loan.startTime + 30 days) {
            return true;
        }
        // Add more logic for undercollateralization, etc.
        return false;
    }

    // Example liquidation action (customize as needed)
    function _liquidate(address borrower, LiquidityPool.Loan memory loan) internal returns (uint256) {
        // Implement actual liquidation logic here, e.g. seize collateral
        // For demonstration, just set loan to zero (should call pool.liquidate(borrower) in real use)
        // pool.liquidate(borrower);
        return loan.amount;
    }
}