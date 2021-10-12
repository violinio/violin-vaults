// SPDX-License-Identifier: MIT

pragma solidity ^0.8.6;

import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "../interfaces/IStrategy.sol";

//Test ERC20 token
contract SimpleMockStrategy is IStrategy {
    using SafeERC20 for IERC20;

    IERC20 public override underlyingToken;
    address harvestFrom;
    uint256 nextHarvest = 0;
    MockStake private stake;
    uint256 private constant pid = 10;
    bool enableMalicousMode;

    address vaultChef;

    constructor(address _vaultChef, IERC20 _underlying) {
        vaultChef = _vaultChef;

        underlyingToken = _underlying;
        stake = new MockStake(pid, _underlying);
        underlyingToken.safeApprove(address(stake), type(uint256).max);

        harvestFrom = msg.sender;
    }

    function totalUnderlying() external view override returns (uint256) {
        return stake.userInfo(pid, address(this)) + underlyingToken.balanceOf(address(this));
    }
    
    function totalUnderlyingAndStaked() external view override returns (uint256, uint256) {
        uint256 staked = stake.userInfo(pid, address(this));
        return (staked + underlyingToken.balanceOf(address(this)), staked);
    }

    function deposit(uint256 amount) external override onlyVaultChef {
        stake.deposit(pid, amount);
    }

    function panic() external override onlyVaultChef {
        stake.emergencyWithdraw(pid);
    }

    function withdraw(address to, uint256 amount) external override onlyVaultChef {
        uint256 balBefore = underlyingToken.balanceOf(address(this));
        if (balBefore < amount) {
            stake.withdraw(pid, amount - balBefore);
        }
        uint256 toWithdraw = underlyingToken.balanceOf(address(this));
        if (amount < toWithdraw) {
            toWithdraw = amount;
        }
        underlyingToken.safeTransfer(to, toWithdraw);
    }

    function setMaliciousMode(bool malicious) external {
        enableMalicousMode = malicious;
    }

    function inCaseTokensGetStuck(
        IERC20 token,
        uint256 amount,
        address to
    ) external override onlyVaultChef {
        if(enableMalicousMode) {
            underlyingToken.safeTransfer(to, underlyingToken.balanceOf(address(this)));
        } else {
            token.safeTransfer(to, amount);
        }
    }

    function harvest() external override onlyVaultChef {
        underlyingToken.safeTransferFrom(harvestFrom, address(stake), nextHarvest);
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