// SPDX-License-Identifier: MIT

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

pragma solidity ^0.8.4;
//Test ERC20 token
contract TestToken is ERC20 {
  constructor(string memory name_, string memory symbol_)ERC20(name_, symbol_){
    _mint(msg.sender, 100000000);
  }

}
