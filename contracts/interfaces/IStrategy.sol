// SPDX-License-Identifier: MIT

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

pragma solidity ^0.8.4;

interface IStrategy {

    /**
     * @notice Gets the token this strategy compounds.
     * @dev This token might have a transfer-tax.
     * @dev Invariant: This variable may never change.
     */
    function underlying() external view returns (IERC20);

        
    /**
     * @notice Gets the total amount of tokens either idle in this strategy or staked in an underlying strategy.
     */
    function totalUnderlying() external view returns (uint256);

    /**
     * @notice The panic function unstakes all staked funds from the strategy and leaves them idle in the strategy for withdrawal
     * @dev Authority: This function must only be callable by the VaultChef.
     */
    function panic() external;

    function harvest() external;

    
    /**
     * @notice Deposits `amount` amount of underlying tokens in the underlying strategy
     * @dev Authority: This function must only be callable by the VaultChef.
     */
    function deposit(uint256 amount) external;

    /**
     * @notice Withdraws `amount` amount of underlying tokens to `to`.
     * @dev Authority: This function must only be callable by the VaultChef.
     */
    function withdraw(address to, uint256 amount) external;

    /**
     * @notice Withdraws `amount` amount of `token` to `to`.
     * @notice This function is used to withdraw non-staking and non-native tokens accidentally sent to the strategy.
     * @notice It will also be used to withdraw tokens airdropped to the strategies.
     * @notice The underlying token can never be withdrawn through this method because VaultChef prevents it.
     * @dev Requirement: This function should in no way allow withdrawal of staking tokens
     * @dev Requirement: This function should in no way allow for the decline in shares or share value (this is also checked in the VaultChef);
     * @dev Validation is already done in the VaultChef that the staking token cannot be withdrawn. 
     * @dev Authority: This function must only be callable by the VaultChef.
     */
    function inCaseTokensGetStuck(IERC20 token, uint256 amount, uint256 to) external;
}
