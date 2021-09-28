// SPDX-License-Identifier: MIT

pragma solidity ^0.8.6;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "../interfaces/IVaultChefWrapper.sol";
import "../interfaces/IERC20Metadata.sol";
import "./VaultChefCore.sol";

/**
 * @notice The VaultChef is the wrapper of the core `VaultChefCore` logic that contains all non-essential functionality.
 * @notice It is isolated from the core functionality because all this functionality has no impact on the core functionality.
 * @notice This separation should enable third party reviewers to more easily assess the core component of the vaultchef.
 
 * @dev One of the main extensions is the added compatibility of the SushiSwap MasterChef interface, this is done to be compatible with third-party tools:
 * @dev Allocpoints have been made binary to indicate whether a vault is paused or not (1 alloc point means active, 0 means paused).
 * @dev Reward related variables are set to zero (lastRewardBlock, accTokenPerShare).
 * @dev Events are emitted on the lower level for more compatibility with third-party tools.
 * @dev EmergencyWithdraw event has been omitted intentionally since it is functionally identical to a normal withdrawal.
 * @dev There is no concept of receipt tokens on the compatibility layer, all amounts represent underlying tokens.
 *
 * @dev ERC-1155 transfers have been wrapped with nonReentrant to reduce the exploit freedom. Furthermore receipt tokens cannot be sent to the VaultChef as it does not implement the receipt interface.
 * 
 * @dev Furthermore the VaultChef implements IERC20Metadata for etherscan compatibility as it currently uses this metadata to identify ERC-1155 collection metadata.
 *
 * @dev Finally safeguards are added to the addVault function to only allow a strategy to be listed once.
 *
 * @dev For third-party reviewers: The security of this extension can be validated since no internal state is modified on the parent contract.
 */
contract VaultChef is VaultChefCore, IVaultChefWrapper {
    // ERC-20 metadata for etherscan compatiblity.
    string private _name = "Violin Vault Receipt";
    string private _symbol = "vVault";
    uint8 private _decimals = 18;

    /// @notice how many vaults are not paused.
    uint256 private activeVaults;

    /// @notice mapping that returns true if the strategy is set as a vault.
    mapping(IStrategy => bool) public strategyExists;
    /// @notice Utility mapping for UI to figure out the vault id of a strategy.
    mapping(IStrategy => uint256) public strategyVaultId;

    event ChangeMetadata(string newName, string newSymbol, uint256 newDecimals);

    //** MASTERCHEF COMPATIBILITY **/

    /// @notice Deposits `amount` of underlying tokens in the vault at `vaultId`.
    /// @dev This function is identical to depositUnderlying, duplication has been permitted to match the masterchef interface.
    /// @dev Event emitted on lower level.
    function deposit(uint256 vaultId, uint256 amount) external override {
        depositUnderlying(vaultId, amount, false, 0);
    }

    /// @notice withdraws `amount` of underlying tokens from the vault at `vaultId` to `msg.sender`.
    /// @dev Event emitted on lower level.
    function withdraw(uint256 vaultId, uint256 underlyingAmount)
        external
        override
    {
        require(isValidVault(vaultId), "!no vault");
        uint256 shares = (totalSupply(vaultId) * underlyingAmount) /
            vaults[vaultId].strategy.totalUnderlying();
        withdrawShares(vaultId, shares, 0);
    }

    /// @notice withdraws the complete position of `msg.sender` to `msg.sender`.
    function emergencyWithdraw(uint256 vaultId) external override {
        require(isValidVault(vaultId), "!no vault");
        uint256 shares = balanceOf(msg.sender, vaultId);
        withdrawShares(vaultId, shares, 0);
    }

    /// @notice poolInfo returns the vault information in a format compatible with the masterchef poolInfo.
    /// @dev allocPoint is either 0 or 1. Zero means paused while one means active.
    /// @dev _lastRewardBlock and _accTokenPerShare are zero since there is no concept of rewards in the VaultChef.
    function poolInfo(uint256 vaultId)
        public
        view
        override
        returns (
            IERC20 _lpToken,
            uint256 _allocPoint,
            uint256 _lastRewardBlock,
            uint256 _accTokenPerShare
        )
    {
        require(isValidVault(vaultId), "!no vault");
        uint256 allocPoints = vaults[vaultId].paused ? 0 : 1;
        return (vaults[vaultId].underlying, allocPoints, 0, 0);
    }

    /// @notice Returns the total amount of underlying tokens a vault has under management.
    function totalUnderlying(uint256 vaultId)
        external
        view
        override
        returns (uint256)
    {
        require(isValidVault(vaultId), "!no vault");
        return vaults[vaultId].strategy.totalUnderlying();
    }

    /// @notice Since there is no concept of allocPoints we return the number of active vaults as allocPoints (each active vault has allocPoint 1) for MasterChef compatibility.
    function totalAllocPoint() external view override returns (uint256) {
        return activeVaults;
    }

    /// @notice Returns the number of vaults.
    function poolLength() external view override returns (uint256) {
        return vaults.length;
    }

    /// @notice the startBlock function indicates when rewards start in a masterchef, since there is no notion of rewards, it returns zero.
    /// @dev This function is kept for compatibility with third-party tools.
    function startBlock() external pure override returns (uint256) {
        return 0;
    }

    /// @notice userInfo returns the user their stake information about a specific vault in a format compatible with the masterchef userInfo.
    /// @dev amount represents the amount of underlying tokens.
    /// @dev _rewardDebt are zero since there is no concept of rewards in the VaultChef.
    function userInfo(uint256 vaultId, address user)
        external
        view
        override
        returns (uint256 _amount, uint256 _rewardDebt)
    {
        require(isValidVault(vaultId), "!no vault");
        uint256 supply = totalSupply((vaultId));
        uint256 underlyingAmount = supply == 0
            ? 0
            : (vaults[vaultId].strategy.totalUnderlying() *
                balanceOf(user, vaultId)) / supply;
        return (underlyingAmount, 0);
    }

    /** Active vault accounting for allocpoints **/

    /// @dev Add accounting for the allocPoints and also locking if the strategy already exists.
    function addVault(IStrategy strategy, uint256 performanceFeeBP) public override {
        require(!strategyExists[strategy], "!exists");
        strategyExists[strategy] = true;
        strategyVaultId[strategy] = vaults.length;
        activeVaults += 1;
        super.addVault(strategy, performanceFeeBP);
    }

    /// @dev _pauseVault is overriden to add accounting for the allocPoints
    /// @dev It should be noted that the first requirement is only present for auditability since it is redundant in the parent contract.
    function _pauseVault(uint256 vaultId, bool paused) internal override {
        require(paused != vaults[vaultId].paused, "!set");
        if (paused) {
            activeVaults -= 1;
        } else {
            activeVaults += 1;
        }
        super._pauseVault(vaultId, paused);
    }

    /** GOVERNANCE FUNCTIONS **/

    /// @notice ERC-20 metadata can be updated for potential rebrands, it is included for etherscan compatibility.
    function changeMetadata(
        string memory newName,
        string memory newSymbol,
        uint8 newDecimals
    ) external override onlyOwner {
        _name = newName;
        _symbol = newSymbol;
        _decimals = newDecimals;

        emit ChangeMetadata(newName, newSymbol, newDecimals);
    }

    /// @notice Override the ERC-1155 token api metadata URI, this is needed since we want to change it to include the chain slug.
    function setURI(string memory newURI) external override onlyOwner {
        string memory oldURI = uri(0);
        _setURI(newURI);

        emit URIUpdated(oldURI, newURI);
    }

    /** ERC-20 METADATA COMPATIBILITY **/

    /// @notice The name of the token collection.
    function name() external view override returns (string memory) {
        return _name;
    }

    /// @notice The shorthand symbol of the token collection.
    function symbol() external view override returns (string memory) {
        return _symbol;
    }

    /// @notice The amount of decimals of individual tokens.
    function decimals() external view override returns (uint8) {
        return _decimals;
    }

    /** ERC-1155 nonReentrant modification to reduce risks **/

    /// @notice override safeTransferFrom with nonReentrant modifier to safeguard system properties.
    function safeTransferFrom(
        address from,
        address to,
        uint256 id,
        uint256 amount,
        bytes memory data
    ) public override nonReentrant {
        super.safeTransferFrom(from, to, id, amount, data);
    }

    /// @notice override safeBatchTransferFrom with nonReentrant modifier to safeguard system properties.
    function safeBatchTransferFrom(
        address from,
        address to,
        uint256[] memory ids,
        uint256[] memory amounts,
        bytes memory data
    ) public override nonReentrant {
        super.safeBatchTransferFrom(from, to, ids, amounts, data);
    }
}
