// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "./LiquidityPool.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract PoolFactory {
    event PoolCreated(address indexed token, address pool);

    mapping(address => address) public getPool;

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
}