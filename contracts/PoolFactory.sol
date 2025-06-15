// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "./LiquidityPool.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract PoolFactory is Ownable {
    event PoolCreated(address indexed token, address pool);

    mapping(address => address) public getPool;

    constructor() Ownable(msg.sender) {
    }

    function createPool(address port, address token, uint256 feeRate) external returns (address pool) {
        require(getPool[token] == address(0), "Pool exists");
        bytes32 salt = keccak256(abi.encodePacked(token));
        pool = address(new LiquidityPool{salt: salt}(port, token, feeRate));
        getPool[token] = pool;
        emit PoolCreated(token, pool);
    }

    function getPoolAddress(address token) external view returns (address) {
        return getPool[token];
    }

    function withdraw(address token, uint256 amount, address to) external onlyOwner {
        IERC20(token).transfer(to, amount);
    }
}