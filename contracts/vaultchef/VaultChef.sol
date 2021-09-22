// SPDX-License-Identifier: MIT

pragma solidity ^0.8.4;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import "../interfaces/IMasterChef.sol";
import "./VaultChefCore.sol";

/**
 * @notice The VaultChef is the wrapper of the core `VaultChefCore` logic and makes this logic compatible with the famous MasterChef interface introduced by SushiSwap.
 */
contract VaultChef is VaultChefCore, IMasterChef {
    
    function deposit(uint256 vaultId, uint256 amount) external override {
        depositUnderlying(vaultId, amount);
    }
    
    function withdraw(uint256 vaultId, uint256 underlyingAmount) external override {
        uint256 shares = totalSupply(vaultId) * underlyingAmount / vaults[vaultId].strategy.totalUnderlying();
        withdrawShares(vaultId, shares);
    }
    function emergencyWithdraw(uint256 vaultId) external override {
        uint256 shares = balanceOf(msg.sender, vaultId);
        withdrawShares(vaultId, shares);
    }
    
    function poolInfo(uint256 vaultId) public override view returns (IERC20 _lpToken, uint256 _allocPoint, uint256 _lastRewardBlock, uint256 _accTokenPerShare) {
        require(isValidVault(vaultId), "!no vault");
        uint256 allocPoints = vaults[vaultId].paused ? 0 : 1;
        return (vaults[vaultId].underlying, allocPoints, 0, 0);
    }

    function totalAllocPoint() external override view returns (uint256) {
        return activeVaults;
    }

    function poolLength() external override view returns (uint256) {
        return vaults.length;
    }

    function startBlock() external override pure returns (uint256) {
        return 0;
    }

    function userInfo(uint256 vaultId, address user) external override view returns (uint256 _amount, uint256 _rewardDebt) {
        require(isValidVault(vaultId), "!no vault");
        uint256 underlyingAmount = vaults[vaultId].strategy.totalUnderlying() * balanceOf(user, vaultId) / totalSupply(vaultId);
        return (underlyingAmount, 0);
    }
}