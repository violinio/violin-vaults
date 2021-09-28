// SPDX-License-Identifier: MIT

pragma solidity ^0.8.6;

import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "../interfaces/IStrategy.sol";

//Test ERC20 token
contract SimpleMockStrategy is IStrategy {
    using SafeERC20 for IERC20;

    IERC20 public override underlying;
    address harvestFrom;
    uint256 nextHarvest = 0;
    MockStake private stake;
    uint256 private constant pid = 10;

    address vaultChef;

    constructor(address _vaultChef, IERC20 _underlying) {
        vaultChef = _vaultChef;

        underlying = _underlying;
        stake = new MockStake(pid, _underlying);
        underlying.safeApprove(address(stake), type(uint256).max);

        harvestFrom = msg.sender;
    }

    function totalUnderlying() external view override returns (uint256) {
        return stake.userInfo(pid, address(this)) + underlying.balanceOf(address(this));
    }

    function deposit(uint256 amount) external override onlyVaultChef {
        stake.deposit(pid, amount);
    }

    function panic() external override onlyVaultChef {
        stake.emergencyWithdraw(pid);
    }

    function withdraw(address to, uint256 amount) external override onlyVaultChef {
        uint256 balBefore = underlying.balanceOf(address(this));
        if (balBefore < amount) {
            stake.withdraw(pid, amount - balBefore);
        }
        uint256 toWithdraw = underlying.balanceOf(address(this));
        if (amount < toWithdraw) {
            toWithdraw = amount;
        }
        underlying.safeTransfer(to, toWithdraw);
    }

    function inCaseTokensGetStuck(
        IERC20 token,
        uint256 amount,
        address to
    ) external override onlyVaultChef {
        token.safeTransfer(to, amount);
    }

    function harvest() external override onlyVaultChef {
        underlying.safeTransferFrom(harvestFrom, address(stake), nextHarvest);
        nextHarvest = 0;
    }
    
    function setNextHarvest(uint256 amount) external {
        nextHarvest = amount;
    }
    modifier onlyVaultChef {
        require(msg.sender == vaultChef, "!vaultchef");
        _;
    }
}

contract MockStake {
    using SafeERC20 for IERC20;
    uint256 pid;
    IERC20 underlying;


    constructor(uint256 _pid, IERC20 _underlying) {
        pid = _pid;
        underlying = _underlying;
    }

    function deposit(uint256 _pid, uint256 amount) external {
        require(pid == _pid, "unsupported");
        underlying.safeTransferFrom(msg.sender, address(this), amount);
    }

    function withdraw(uint256 _pid, uint256 amount) external {
        require(pid == _pid, "unsupported");
        underlying.safeTransfer(msg.sender, amount);
    }
    function emergencyWithdraw(uint256 _pid) external {
        require(pid == _pid, "unsupported");
        underlying.safeTransfer(msg.sender, userInfo(_pid, msg.sender));
    }

    function userInfo(uint256 _pid, address user) public view returns (uint256 amount) {
        require(pid == _pid, "unsupported");
        user; // shh
        return underlying.balanceOf(address(this));
    }
}