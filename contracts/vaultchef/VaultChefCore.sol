// SPDX-License-Identifier: MIT

pragma solidity ^0.8.6;

import "../dependencies/ERC1155Supply.sol";
import "../dependencies/Ownable.sol";
import "../interfaces/IStrategy.sol";
import "../interfaces/IVaultChefCore.sol";
import "../interfaces/IPullDepositor.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Address.sol";

/**
 * @title VaultChefCore
 * @notice A vault management contract that manages vaults, their strategies and the share positions of investors in these vaults.
 * @notice Documentation is present in the IVaultChefCore interface.
 */
contract VaultChefCore is ERC1155Supply, IVaultChefCore, Ownable, ReentrancyGuard {
    using Address for address;
    using SafeERC20 for IERC20;
    
    /// @notice The list of all registered vaults.
    Vault[] internal vaults;

    uint256 private constant MAX_PERFORMANCE_FEE_BP = 500;

    event VaultAdded(uint256 indexed vaultId, IStrategy indexed strategy, uint256 performanceFeeBP);
    event VaultSet(uint256 indexed vaultId, uint256 performanceFeeBP);
    event VaultPaused(uint256 indexed vaultId, bool paused);
    event VaultPanicked(uint256 indexed vaultId);
    event VaultHarvest(uint256 indexed vaultId, uint256 underlyingIncrease);
    event VaultInCaseTokenStuck(uint256 indexed vaultId, IERC20 indexed token, address indexed to, uint256 amount);
    event URIUpdated(string oldURI, string newURI);
    event InCaseTokenStuck(IERC20 indexed token, address indexed to, uint256 amount);

    event Deposit(uint256 indexed vaultId, address indexed user, uint256 sharesAmount, uint256 underlyingAmountReceived);
    event Withdraw(uint256 indexed vaultId, address indexed user, address receiver, uint256 sharesAmount, uint256 underlyingAmountReceived);

    constructor() ERC1155("https://violin.finance/api/vaults/{id}.json") {}

    //** USER FUNCTIONS *//

    function depositUnderlying(uint256 vaultId, uint256 underlyingAmount, bool pulled, uint256 minSharesReceived) public override nonReentrant returns (uint256 sharesReceived) {
        require(isValidVault(vaultId), "!no vault");
        _harvest(vaultId);
        Vault memory vault = vaults[vaultId];
        require(!vault.paused, "!paused");

        // Variables for shares calculation.
        uint256 totalSharesBefore = totalSupply(vaultId);
        uint256 underlyingBefore = vault.strategy.totalUnderlying();

        // Transfer in the funds from the msg.sender to the strategy contract.
        underlyingAmount = _transferInFunds(vault.underlying, address(vault.strategy), underlyingAmount, pulled);

        // Make the strategy stake the received funds.
        vault.strategy.deposit(underlyingAmount);

        uint256 underlyingAfter = vault.strategy.totalUnderlying();
        underlyingAmount = underlyingAfter - underlyingBefore;

        // Mint shares according to the actually received underlyingAmount, based on the share value before deposit.
        uint256 shares = totalSharesBefore != 0 && underlyingBefore != 0 ? (underlyingAmount * totalSharesBefore) / underlyingBefore : underlyingAmount;
        _mint(msg.sender, vaultId, shares, ""); // Reentrancy hook has been removed from our ERC-1155 implementation (only modification).

         // Gas optimized non-decreasing share value requirement.
        require(underlyingAfter * totalSharesBefore >= underlyingBefore * totalSupply(vaultId) || totalSharesBefore == 0, "!share value decrease");
        // We require the total underlying in the vault to be within reasonable bounds to prevent mulDiv overflow on withdrawal (1e34^2 is still 9 magnitudes smaller than type(uint256).max)
        // Using https://github.com/Uniswap/v3-core/blob/2ac90dd32184f4c5378b19a08bce79492ea23d37/contracts/libraries/FullMath.sol would be a better alternative but goes against our simplicity principle.
        require(underlyingAfter <= 1e34, "!unsafe");
        require(shares >= minSharesReceived, "!min not received");
        emit Deposit(vaultId, msg.sender, shares, underlyingAmount);
        return shares;
    }

    function withdrawShares(uint256 vaultId, uint256 shares, uint256 minReceived) public override nonDecreasingShareValue(vaultId) nonReentrant returns (uint256 underlyingReceived) {
        return _withdrawSharesTo(vaultId, shares, minReceived, msg.sender);
    }

    function withdrawSharesTo(
        uint256 vaultId,
        uint256 shares,
        uint256 minReceived,
        address to
    ) public override nonDecreasingShareValue(vaultId) nonReentrant returns (uint256 underlyingReceived) {
        // Withdrawing to another wallet should only be done by zapping contracts thus we can add a phishing measure
        require(address(msg.sender).isContract(), "!to phishing");
        return _withdrawSharesTo(vaultId, shares, minReceived, to);
    }
    
    /// @notice isValidVault is implicit through nonDecreasingShareValue (gas optimization)
    function _withdrawSharesTo(
        uint256 vaultId,
        uint256 shares,
        uint256 minReceived,
        address to
    ) internal returns (uint256 underlyingReceived) {
        require(balanceOf(msg.sender, vaultId) >= shares, "!insufficient shares");
        require(shares > 0, "!zero shares");
        Vault memory vault = vaults[vaultId];
        
        uint256 withdrawAmount = (shares * vault.strategy.totalUnderlying()) / totalSupply(vaultId);
        _burn(msg.sender, vaultId, shares);

        uint256 balanceBefore = vault.underlying.balanceOf(to);
        vault.strategy.withdraw(to, withdrawAmount);
        withdrawAmount = vault.underlying.balanceOf(to) - balanceBefore;

        require(withdrawAmount >= minReceived, "!min not received");
        emit Withdraw(vaultId, msg.sender, to, shares, withdrawAmount);
        return withdrawAmount;
    }

    /// @notice Transfers in tokens from the `msg.sender` to `to`. Returns the actual receivedAmount that can be both lower and higher
    /// @param pulled Whether to use a pulled-based mechanism
    /// @dev Requires reentrancy-guard and no way for the staked funds to be sent back into the strategy within the before-after.
    function _transferInFunds(IERC20 token, address to, uint256 underlyingAmount, bool pulled) internal returns(uint256 receivedAmount) {
        uint256 beforeBal = token.balanceOf(to);
        if(!pulled) {
            token.safeTransferFrom(msg.sender, to, underlyingAmount);
        }else {
            IPullDepositor(msg.sender).pullTokens(token, underlyingAmount, to);
        }
        return token.balanceOf(to) - beforeBal;
    }

    //** GOVERNANCE FUNCTIONS *//

    /// @dev nonDecreasingUnderlyingValue(vaultId) omitted since it is implicitly defined.
    function harvest(uint256 vaultId) external override onlyOwner nonReentrant returns (uint256 underlyingIncrease) { 
        require(isValidVault(vaultId), "!no vault");
        require(!vaults[vaultId].paused, "!paused");

        return _harvest(vaultId);
    }
    
    /// @dev Gas optimization: Implicit nonDecreasingShareValue due to no supply change within _harvest (reentrancyGuards guarantee this).
    /// @dev Gas optimization: Implicit nonDecreasingUnderlyingValue check due to before-after underflow.
    function _harvest(uint256 vaultId) internal returns (uint256 underlyingIncrease) {
        Vault storage vault = vaults[vaultId];
        IStrategy strategy = vault.strategy;
        
        uint256 underlyingBefore = strategy.totalUnderlying();
        strategy.harvest();
        uint256 underlyingAfter = strategy.totalUnderlying();
        underlyingIncrease = underlyingAfter - underlyingBefore;

        vault.lastHarvestTimestamp = block.timestamp;

        // The performance fee is minted to the feeAddress in shares to reduce governance risk, strategy complexity and gas fees.
        if(underlyingIncrease > 0 && owner() != address(0)) {
            uint256 performanceFeeShares = (underlyingIncrease * totalSupply(vaultId) * vault.performanceFeeBP) / underlyingAfter / 10000;
            _mint(owner(), vaultId, performanceFeeShares, "");
        }

        emit VaultHarvest(vaultId, underlyingIncrease);
        return underlyingIncrease;
    }

    function addVault(IStrategy strategy, uint256 performanceFeeBP) public virtual override onlyOwner nonReentrant {
        require(performanceFeeBP <= MAX_PERFORMANCE_FEE_BP, "!too high");
        vaults.push(Vault({underlying: strategy.underlying(), strategy: strategy, paused: false, panicked: false, panicTimestamp: 0, lastHarvestTimestamp: 0, performanceFeeBP: performanceFeeBP}));
        emit VaultAdded(vaults.length - 1, strategy, performanceFeeBP);
    }

    function setVault(uint256 vaultId, uint256 performanceFeeBP) external virtual override onlyOwner nonReentrant {
        require(isValidVault(vaultId), "!no vault");
        require(performanceFeeBP <= MAX_PERFORMANCE_FEE_BP, "!too high");
        Vault storage vault = vaults[vaultId];
        vault.performanceFeeBP = performanceFeeBP;
        
        emit VaultSet(vaultId, performanceFeeBP);
    }

    function panicVault(uint256 vaultId) external override onlyOwner nonReentrant {
        require(isValidVault(vaultId), "!no vault");
        Vault storage vault = vaults[vaultId];
        require(!vault.panicked, "!panicked");
        if (!vault.paused) _pauseVault(vaultId, true);
        vault.panicked = true;
        vault.panicTimestamp = block.timestamp;

        vault.strategy.panic();

        emit VaultPanicked(vaultId);
    }

    function pauseVault(uint256 vaultId, bool paused) external override onlyOwner nonReentrant {
        require(isValidVault(vaultId), "!no vault");
        _pauseVault(vaultId, paused);
    }

    /// @notice Marks the vault as paused which means no deposits or harvests can occur anymore.
    function _pauseVault(uint256 vaultId, bool paused) internal virtual {
        Vault storage vault = vaults[vaultId];
        require(!vault.panicked, "!panicked");
        require(paused != vault.paused, "!set");
        vault.paused = paused;
        emit VaultPaused(vaultId, paused);
    }

    /// @notice No staked tokens are ever sent to the VaultChef, only to the strategies.
    function inCaseTokensGetStuck(IERC20 token, address to) external override onlyOwner nonReentrant {
        uint256 amount = token.balanceOf(address(this));
        token.safeTransfer(to, amount);
        emit InCaseTokenStuck(token, to, amount);
    }

    /// @notice All though the strategy could contain underlying tokens, this function reverts if governance tries to withdraw these.
    function inCaseVaultTokensGetStuck(
        uint256 vaultId,
        IERC20 token,
        address to,
        uint256 amount
    ) external override onlyOwner nonReentrant nonDecreasingUnderlyingValue(vaultId) {
        require(isValidVault(vaultId), "!no vault");
        Vault storage vault = vaults[vaultId];
        require(token != vault.underlying, "!underlying");

        vault.strategy.inCaseTokensGetStuck(token, amount, to);
        emit VaultInCaseTokenStuck(vaultId, token, to, amount);
    }

    //** VIEW FUNCTIONS *//

    /// @notice returns whether a vault exists at the provided vault id `vaultId`.
    function isValidVault(uint256 vaultId) public override view returns (bool) {
        return vaultId < vaults.length;
    }

    /// @notice Returns information about the vault for the frontend to use.
    function vaultInfo(uint256 vaultId) public override view returns (Vault memory) {
        return vaults[vaultId];
    }

    //** MODIFIERS **//
    
    /// @dev the nonDecreasingShareValue modifier requires the vault's share value to be nondecreasing over the operation.
    modifier nonDecreasingShareValue(uint256 vaultId) {
        require(isValidVault(vaultId), "!no vault");
        uint256 supply = totalSupply(vaultId);
        uint256 underlyingBefore = vaults[vaultId].strategy.totalUnderlying();
        _;
        if(supply == 0) return;
        uint256 underlyingAfter = vaults[vaultId].strategy.totalUnderlying();
        uint256 newSupply = totalSupply(vaultId);
        // This is a rewrite of shareValueAfter >= shareValueBefore which also passes if newSupply is zero
        require(underlyingAfter * supply >= underlyingBefore * newSupply, "!share decrease");
    }

    /// @dev the nonDecreasingVaultValue modifier requires the vault's total underlying tokens to not decrease over the operation.
    modifier nonDecreasingUnderlyingValue(uint256 vaultId) {
        require(isValidVault(vaultId), "!no vault");
        Vault storage vault = vaults[vaultId];
        uint256 balanceBefore = vault.strategy.totalUnderlying();
        _;
        uint256 balanceAfter = vault.strategy.totalUnderlying();
        require(balanceAfter >= balanceBefore, "!vault balance decrease");
    }

    //** REQUIRED OVERRIDES *//
    /// @dev Due to multiple inheritence, we require to overwrite the totalSupply method.
    function totalSupply(uint256 id) public view override(ERC1155Supply, IVaultChefCore) returns (uint256) {
        return super.totalSupply(id);
    }
}