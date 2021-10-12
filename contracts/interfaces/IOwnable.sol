// SPDX-License-Identifier: MIT

pragma solidity ^0.8.6;


interface IOwnable {
   function transferOwnership() external;
   function setPendingOwner(address newPendingOwner) external;
}
