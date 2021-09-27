// SPDX-License-Identifier: MIT

pragma solidity ^0.8.6;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

interface IPullDepositor {
    /**
     * @notice Called by a contract requesting tokens, with the aim of the PullDepositor implementing contract to send these tokens.
     * @dev This interface allows for an alternative flow compared to the traditional transferFrom flow.
     * @dev This flow is especially useful when in combination with a zapping contract.
     */
    function pullTokens(
        IERC20 token,
        uint256 amount,
        address to
    ) external;
}
