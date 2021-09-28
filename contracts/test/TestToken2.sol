// SPDX-License-Identifier: MIT

pragma solidity ^0.8.6;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

//Test ERC20 token
contract TestToken2 is ERC20 {
    constructor(string memory name_, string memory symbol_)
        ERC20(name_, symbol_)
    {
    }

    function mint(uint256 amount) external {
        _mint(msg.sender, amount);
    }
}
