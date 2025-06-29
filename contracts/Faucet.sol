// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract Faucet {
    IERC20 public immutable token;
    uint256 public immutable amount;
    mapping(address => bool) public hasClaimed;

    event Claimed(address indexed user, uint256 amount);

    constructor(address _token, uint256 _amount) {
        token = IERC20(_token);
        amount = _amount;
    }

    function claim() external {
        require(!hasClaimed[msg.sender], "Already claimed");
        hasClaimed[msg.sender] = true;
        require(token.transfer(msg.sender, amount), "Transfer failed");
        emit Claimed(msg.sender, amount);
    }
}