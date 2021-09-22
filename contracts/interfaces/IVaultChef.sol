// SPDX-License-Identifier: MIT

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC1155/IERC1155.sol";
import "./IStrategy.sol";

pragma solidity ^0.8.4;

interface IVaultChef is IERC1155 {
    /**
     * @notice Deposits `amount` underlying tokens into the vault.
     * @notice The tokens are transferred from `msg.sender` which requires approval.
     * @notice Deposit mints the shares as ERC-1155 tokens to the sender with the tokenId equal to the vaultId.
     * @param vaultId The id of the vault.
     * @param underlyingAmount The amount of underlying tokens to deposit into the strategy.
     * @return sharesReceived The number of shares minted to the msg.sender.
     */
    function depositUnderlying(uint256 vaultId, uint256 underlyingAmount) external returns (uint256 sharesReceived);

    /**
     * @notice Deposits tokens by calling a hook on the msg.sender.
     * @notice The pull hook allows the msg.sender to transfer tokens themselves instead of using the transferFrom flow.
     * @notice This methodology is extremely valuable for zapping transfer-tax tokens more economically.
     * @notice Deposit mints the shares as ERC-1155 tokens to the sender with the tokenId equal to the vaultId.
     * @dev `msg.sender` must be a smart contract implementing the `IPullDepositor` interface.
     * @dev Requirement: No guarantee on the amount of underlying tokens actually sent should be made.
     * @dev Requirement: The function must mitigate reentrancy vectors.
     * @param vaultId The id of the vault.
     * @param underlyingAmount The amount of underlying tokens to request from the msg.sender.
     * @return sharesReceived The number of shares minted to the msg.sender.
     */
    function depositPulled(uint256 vaultId, uint256 underlyingAmount) external returns (uint256 sharesReceived);

    function withdrawShares(uint256 vaultId, uint256 shareAmount) external returns (uint256 underlyingReceived);
    /**
     * @notice Total amount of shares of a given vaultId.
     * @param id The vaultId.
     * @return The total number of shares currently in circulation.
     */
    function totalSupply(uint256 id) external view returns (uint256);

    function harvest(uint256 vaultid) external;
    function addVault(IStrategy strategy) external;
    function panicVault(uint256 vaultId) external;
    function pauseVault(uint256 vaultId, bool paused) external;
    function inCaseTokensGetStuck(IERC20 token, address to) external;
    function inCaseVaultTokensGetStuck(uint256 vaultId, IERC20 token, address to, uint256 amount) external;
}
