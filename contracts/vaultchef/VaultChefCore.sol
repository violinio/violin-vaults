// SPDX-License-Identifier: MIT

pragma solidity ^0.8.4;

import "@openzeppelin/contracts/token/ERC1155/extensions/ERC1155Supply.sol";
import "@openzeppelin/contracts/token/ERC1155/ERC1155.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

import "../interfaces/IStrategy.sol";
import "../interfaces/IVaultChef.sol";
import "../interfaces/IPullDepositor.sol";

// TODO: DECIMALZZZ?
// TODO: DONT CALL REENTRANCY HOOK ON ERC1155!!
contract VaultChefCore is IVaultChef, ERC1155Supply, Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20; 

    struct Vault {
        /// @notice The token this strategy will compound.
        IERC20 underlying;
        /// @notice The strategy contract.
        IStrategy strategy;
        /// @notice Whether deposits are currently paused.
        bool paused;
        /// @notice Whether the vault has panicked which means the funds are pulled from the strategy and it is paused forever.
        bool panicked;
    }

    /// @notice how many vaults are not paused
    uint256 activeVaults;

    /// @notice The list of all registered vaults
    Vault[] public vaults;

    /// @notice mapping that returns true if the strategy is set as a vault
    mapping(IStrategy => bool) public strategyExists;
    /// @notice Utility mapping for UI to figure out the vault id of a strategy
    mapping(IStrategy => uint256) public strategyVaultId;

    event VaultAdded(IStrategy indexed strategy);
    event VaultPaused(uint256 indexed vaultId, bool paused);
    event vaultPanicked(uint256 indexed vaultId);
    event VaultHarvest(uint256 indexed vaultId, uint256 underlyingIncrease);
    event VaultInCaseTokenStuck(uint256 indexed vaultId, IERC20 indexed token, address indexed to, uint256 amount);
    event URIUpdated(string oldURI, string newURI);
    event InCaseTokenStuck(IERC20 indexed token, address indexed to, uint256 amount);
    
    // TODO: DEPOSIT AND WITHDRAW EVENTS? Or are the mint and burn events sufficient?

    constructor() ERC1155("https://violin.finance/api/vaults/{id}.json") {}

    //** USER FUNCTIONS *//
    /**
     * TODO: DOCS
     * TODO: RGs
     * @dev Function is marked as public since it is used within the VaultChef layer.
     */
    function depositUnderlying(uint256 vaultId, uint256 underlyingAmount)
        public
        override
        nonDecreasingShareValue(vaultId)
        nonReentrant
        returns (uint256 sharesReceived)
    {
        require(isValidVault(vaultId), "!no vault");
        Vault memory vault = vaults[vaultId];
        require(!vault.paused, "!paused");
        vault.strategy.harvest();
        uint256 beforeBal = vault.underlying.balanceOf(address(vault.strategy));
        vault.underlying.safeTransferFrom(
            msg.sender,
            address(vault.strategy),
            underlyingAmount
        );
        underlyingAmount =
            vault.underlying.balanceOf(address(vault.strategy)) -
            beforeBal;
        return _stake(msg.sender, vaultId, underlyingAmount);
    }

    function depositPulled(uint256 vaultId, uint256 underlyingAmount)
        external
        override
        nonDecreasingShareValue(vaultId)
        nonReentrant
        returns (uint256 sharesReceived)
    {
        require(isValidVault(vaultId), "!no vault");
        Vault memory vault = vaults[vaultId];
        require(!vault.paused, "!paused");
        vault.strategy.harvest();
        uint256 beforeBal = vault.underlying.balanceOf(address(vault.strategy));
        IPullDepositor(msg.sender).pullTokens(
            vault.underlying,
            underlyingAmount,
            address(vault.strategy)
        );
        underlyingAmount =
            vault.underlying.balanceOf(address(vault.strategy)) -
            beforeBal;
        return _stake(msg.sender, vaultId, underlyingAmount);
    }

    function _stake(
        address shareReceiver,
        uint256 vaultId,
        uint256 underlyingAmount
    ) internal returns (uint256 sharesReceived) {
        Vault memory vault = vaults[vaultId];
        // UnderlyingAmount must be equal to the amount of tokens actually received by the strategy (axioma). 
        // Therefore we can simply get the totalUnderlying before the deposit through subtraction.
        uint256 beforeBal = vault.strategy.totalUnderlying() - underlyingAmount;
        // Deposit the tokens that were already transferred to the vault
        vault.strategy.deposit(underlyingAmount);
        underlyingAmount = vault.strategy.totalUnderlying() - beforeBal;

        uint256 shares = (underlyingAmount * 1e18) / shareValue(vaultId);
        _mint(shareReceiver, vaultId, shares, ""); // TODO: Remove reentrancy vector from ERC-1155, it has no value
        return shares;
    }

    // TODO: What does modifier do if the share value goes to zero???
    // TODO: Add to parameter which can only be set if msg.sender is a contract. The purpose is for efficient zapping withdrawals with transfer taxes
    function withdrawShares(uint256 vaultId, uint256 shares)
        public
        override
        nonDecreasingShareValue(vaultId)
        nonReentrant
        returns (uint256 underlyingReceived)
    {
        require(isValidVault(vaultId), "!no vault");
        Vault storage vault = vaults[vaultId];

        _burn(msg.sender, vaultId, shares);

        uint256 withdrawAmount = (shareValue(vaultId) * shares) / 1e18;
        uint256 balanceBefore = vault.underlying.balanceOf(msg.sender);
        vault.strategy.withdraw(msg.sender, withdrawAmount);
        withdrawAmount = vault.underlying.balanceOf(msg.sender) - balanceBefore;

        return withdrawAmount;
    }

    //** GOVERNANCE FUNCTIONS *//

    // TODO: Move privilege to harvester role (RBAC)
    function harvest(uint256 vaultId) external override nonDecreasingShareValue(vaultId) nonDecreasingUnderlyingValue(vaultId) onlyOwner nonReentrant {
        require(isValidVault(vaultId), "!no vault");
        Vault storage vault = vaults[vaultId];
        require(!vault.paused, "!paused");
        uint256 underlyingBefore = vault.strategy.totalUnderlying();
        vault.strategy.harvest();
        uint256 underlyingIncrease = vault.strategy.totalUnderlying() - underlyingBefore;

        emit VaultHarvest(vaultId, underlyingIncrease);
    }

    function addVault(IStrategy strategy) external override onlyOwner {
        require(!strategyExists[strategy], "!exists");

        vaults.push(
            Vault({
                underlying: strategy.underlying(),
                strategy: strategy,
                paused: false,
                panicked: false
            })
        );

        strategyExists[strategy] = true;
        strategyVaultId[strategy] = vaults.length - 1;

        activeVaults += 1;

        emit VaultAdded(strategy);
    }

    function panicVault(uint256 vaultId)
        external
        override
        onlyOwner
        nonReentrant
    {
        require(isValidVault(vaultId), "!no vault");
        Vault storage vault = vaults[vaultId];
        require(!vault.panicked, "Already panicked");
        _pauseVault(vaultId, true);
        vault.panicked = true;
        vault.strategy.panic();

        emit vaultPanicked(vaultId);
    }

    // TODO: This should be callable by an EOA, add PauseGuardian role (only owner can unpause however)
    function pauseVault(uint256 vaultId, bool paused)
        external
        override
        onlyOwner
        nonReentrant
    {
        require(isValidVault(vaultId), "!no vault");
        _pauseVault(vaultId, paused);
    }

    function _pauseVault(uint256 vaultId, bool paused) internal {
        Vault storage vault = vaults[vaultId];
        require(!vault.panicked, "Panicked");

        if (paused != vault.paused) {
            vault.paused = paused;
            if (paused) {
                activeVaults -= 1;
            } else {
                activeVaults += 1;
            }

            emit VaultPaused(vaultId, paused);
        }
    }

    function inCaseTokensGetStuck(IERC20 token, address to)
        external
        override
        onlyOwner
        nonReentrant
    {
        uint256 amount = token.balanceOf(address(this));
        token.safeTransfer(to, amount);
        emit InCaseTokenStuck(token, to, amount);
    }
    
    function inCaseVaultTokensGetStuck(uint256 vaultId, IERC20 token, address to, uint256 amount)
        external
        override
        onlyOwner
        nonReentrant
        nonDecreasingUnderlyingValue(vaultId)
    {
        require(isValidVault(vaultId), "!no vault");
        // require(!vault.panicked, "!panicked"); ? is this necessary ? perhaps we add a 2 month panic timer and disable the requirement after this?
        Vault storage vault = vaults[vaultId];
        
        require(token != vault.underlying, "!underlying");
        token.safeTransfer(to, amount);
        emit VaultInCaseTokenStuck(vaultId, token, to, amount);
    }


    /// @notice Override the token api URI, this is needed since we want to change it to include the chain slug.
    function setURI(string memory newURI) external onlyOwner {
        string memory oldURI = uri(0); // We use a simple uri template which is identical for all tokens.
        _setURI(newURI);

        emit URIUpdated(oldURI, newURI);
    }

    //** VIEW FUNCTIONS *//

    /// @notice returns whether a vault exists at the provided vault id `vaultId`.
    function isValidVault(uint256 vaultId) public view returns (bool) {
        return vaultId < vaults.length;
    }

    /// @notice returns the 1e18 scaled totalUnderlying/totalShares value
    /// @notice returns 1e18 if there are no shares
    /// @dev IMPORTANT: Always remember to consider the case where totalSupply is zero when using this function.
    function shareValue(uint256 vaultId) internal view returns (uint256) {
        uint256 supply = totalSupply(vaultId);
        if (supply == 0) return 1e18;
        return (vaults[vaultId].strategy.totalUnderlying() * 1e18) / supply;
    }

    //** MODIFIERS **//
    /// @dev the nonDecreasingShareValue modifier requires the vault's share value to be nondecreasing over the operation
    modifier nonDecreasingShareValue(uint256 vaultId) {
        uint256 shareValueBefore = totalSupply(vaultId) != 0
            ? shareValue(vaultId)
            : 0;
        _;
        if (totalSupply(vaultId) == 0)
            // We return early if there are no remaining shares since all shares since there is also no value at this point to validate.
            return;
        uint256 shareValueAfter = shareValue(vaultId);
        require(shareValueAfter >= shareValueBefore, "share value decreased");
    }

    /// @dev the nonDecreasingVaultValue modifier requires the vault's total underlying tokens to not decrease over the operation.
    modifier nonDecreasingUnderlyingValue(uint256 vaultId) {
        Vault storage vault = vaults[vaultId];
        uint256 balanceBefore = vault.strategy.totalUnderlying();
        _;
        uint256 balanceAfter = vault.strategy.totalUnderlying();
        require(balanceAfter >= balanceBefore, "vault balance decreased");
    }

    //** REQUIRED OVERRIDES *//

    function totalSupply(uint256 id)
        public
        view
        override(ERC1155Supply, IVaultChef)
        returns (uint256)
    {
        return super.totalSupply(id);
    }
}
