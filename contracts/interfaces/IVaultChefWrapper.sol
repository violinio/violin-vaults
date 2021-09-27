// SPDX-License-Identifier: MIT

pragma solidity ^0.8.6;

import "./IMasterChef.sol";
import "./IERC20Metadata.sol";

interface IVaultChefWrapper is IMasterChef, IERC20Metadata{
     /**
     * @notice Interface function to fetch the total underlying tokens inside a vault.
     * @notice Calls the totalUnderlying function on the vault strategy.
     * @param vaultId The id of the vault.
     */
    function totalUnderlying(uint256 vaultId) external view returns (uint256);

     /**
     * @notice Changes the ERC-20 metadata for etherscan listing.
     * @param newName The new ERC-20-like token name.
     * @param newSymbol The new ERC-20-like token symbol.
     * @param newDecimals The new ERC-20-like token decimals.
     */
    function changeMetadata(
        string memory newName,
        string memory newSymbol,
        uint8 newDecimals
    ) external;

     /**
     * @notice Sets the ERC-1155 metadata URI.
     * @param newURI The new ERC-1155 metadata URI.
     */
    function setURI(string memory newURI) external;

}
