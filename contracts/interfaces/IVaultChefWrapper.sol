// SPDX-License-Identifier: MIT

import "./IMasterChef.sol";
import "./IERC20Metadata.sol";
pragma solidity ^0.8.4;


interface IVaultChefWrapper is IMasterChef, IERC20Metadata{
     /**
     * @notice Interface function to fetch the total underlying tokens inside a vault.
     * @notice Calls the totalUnderlying function on the vault strategy
     * @param vaultId The id of the vault.
     */
    function totalUnderlying(uint256 vaultId) external view returns (uint256);

    function changeMetadata(
        string memory newName,
        string memory newSymbol,
        uint8 newDecimals
    ) external;

    function setURI(string memory newURI) external;

}
