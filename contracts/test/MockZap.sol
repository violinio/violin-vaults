// SPDX-License-Identifier: MIT

pragma solidity ^0.8.6;

import "@openzeppelin/contracts/token/ERC1155/IERC1155Receiver.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/introspection/ERC165Storage.sol";
import "../interfaces/IVaultChef.sol";
import "../interfaces/IPullDepositor.sol";

//Test ERC20 token
contract MockZap is IERC1155Receiver, ERC165Storage {
    using SafeERC20 for IERC20;
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
    address _from;
    IERC20 _token;
    uint256 _amount;
    function depositPull(uint256 vaultId, uint256 underlyingAmount, uint256 minSharesReceived) external {
        _from = msg.sender;      
        _token = vaultChef.vaultInfo(vaultId).underlyingToken;
        _amount = underlyingAmount;
        uint256 sharesReceived = vaultChef.depositUnderlying(vaultId, underlyingAmount, true, minSharesReceived);
        _from = address(0);
        _token = IERC20(address(0));
        _amount = 0;
        vaultChef.safeTransferFrom(address(this), msg.sender, 0, sharesReceived, "");
    }

    function pullTokens(
        IERC20 token,
        uint256 amount,
        address to
    ) external {
        require(msg.sender == address(vaultChef));
        require(tx.origin == _from);
        require(_token == token);
        require(amount <= _amount);
        token.safeTransferFrom(_from, to, amount);
    }
}
