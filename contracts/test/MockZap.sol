// SPDX-License-Identifier: MIT

pragma solidity ^0.8.6;

import "@openzeppelin/contracts/token/ERC1155/IERC1155Receiver.sol";
import "@openzeppelin/contracts/utils/introspection/ERC165Storage.sol";
import "../interfaces/IVaultChef.sol";

//Test ERC20 token
contract MockZap is IERC1155Receiver, ERC165Storage {
    IVaultChef vaultChef;

    constructor(IVaultChef _vaultChef) {
        vaultChef = _vaultChef;

        _registerInterface(type(IERC1155Receiver).interfaceId);
    }
    
    // Requires approval
    function withdrawSharesTo(uint256 vaultId, uint256 shares, uint256 minUnderlyingReceived, address to) external returns (uint256) {
        vaultChef.safeTransferFrom(msg.sender, address(this), vaultId, shares, "");
        return vaultChef.withdrawSharesTo(vaultId, shares, minUnderlyingReceived, to);
    }

    function onERC1155Received(
        address operator,
        address from,
        uint256 id,
        uint256 value,
        bytes calldata data
    ) external override pure returns (bytes4) {
        operator;from;id;value;data;
        return IERC1155Receiver.onERC1155Received.selector;
    }

    function onERC1155BatchReceived(
        address operator,
        address from,
        uint256[] calldata ids,
        uint256[] calldata values,
        bytes calldata data
    ) external override pure returns (bytes4) {
        operator;from;ids;values;data;
        return IERC1155Receiver.onERC1155BatchReceived.selector;
    }
}
