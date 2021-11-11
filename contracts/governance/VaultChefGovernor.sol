// SPDX-License-Identifier: MIT

pragma solidity ^0.8.6;

import "@openzeppelin/contracts/token/ERC1155/IERC1155Receiver.sol";
import "@openzeppelin/contracts/access/AccessControlEnumerable.sol";
import "../interfaces/IVaultChef.sol";
import "../interfaces/IOwnable.sol";

/**
 * @notice The VaultChefGovernor is the first owner of the vaultchef and manages the permissions of various
 * @notice Privileged addresses can be inspected by iterating over the different roles (ADD_VAULT_ROLE, SET_VAULT_ROLE, PAUSE_VAULT_ROLE and DEFAULT_ADMIN_ROLE).
 * @notice ADD_VAULT_ROLE can add new vaults to the vaultChef
 * @notice SET_VAULT_ROLE can update the performance fee of vaults on the vaultChef
 * @notice PAUSE_VAULT_ROLE can pause and panic vaults on the vaulChef
 * @notice DEFAULT_ADMIN_ROLE is the administrator to modify roles and can furthermore call the rest of the governance functions. These should be multisigs or long timelocks.
 * @notice DEFAULT_ADMIN_ROLE can also execute arbitrary functions so it can do all the actions of the other roles as well.
 */
contract VaultChefGovernor is AccessControlEnumerable, IERC1155Receiver {
    /// @dev The underlying vaultChef to administer.
    IVaultChef public immutable vaultChef;

    /// @dev Can add new vaults to the vaultChef.
    bytes32 public constant ADD_VAULT_ROLE = keccak256("ADD_VAULT_ROLE");
    /// @dev Can update the performance fee of vaults.
    bytes32 public constant SET_VAULT_ROLE = keccak256("SET_VAULT_ROLE");
    /// @dev Can pause and panic vaults.
    bytes32 public constant PAUSE_VAULT_ROLE = keccak256("PAUSE_VAULT_ROLE");
    /// @dev Can process harvest fees.
    bytes32 public constant FEE_PROCESSOR_ROLE =
        keccak256("FEE_PROCESSOR_ROLE");

    event FeesTransferred(
        uint256 indexed fromId,
        uint256 indexed length,
        address indexed to
    );

    constructor(IVaultChef _vaultChef, address _owner) {
        vaultChef = _vaultChef;
        /// @dev Make msg.sender the default admin
        _setupRole(DEFAULT_ADMIN_ROLE, _owner);
        _grantAllRoles(_owner);
    }

    /// @notice Grants an account all roles. Must be called from a DEFAULT_ADMIN.
    function grantAllRoles(address account)
        public
        onlyRole(DEFAULT_ADMIN_ROLE)
    {
        _grantAllRoles(account);
    }

    function _grantAllRoles(address account) internal {
        _setupRole(DEFAULT_ADMIN_ROLE, account);
        _setupRole(ADD_VAULT_ROLE, account);
        _setupRole(SET_VAULT_ROLE, account);
        _setupRole(PAUSE_VAULT_ROLE, account);
    }

    /// @notice Revokes all roles from an account. Must be called by a DEFAULT_ADMIN.
    function revokeAllRoles(address account)
        external
        onlyRole(DEFAULT_ADMIN_ROLE)
    {
        revokeRole(ADD_VAULT_ROLE, account);
        revokeRole(SET_VAULT_ROLE, account);
        revokeRole(PAUSE_VAULT_ROLE, account);
        revokeRole(DEFAULT_ADMIN_ROLE, account);
    }

    /// @notice Generic function proxy, only callable by the DEFAULT_ADMIN.
    function executeTransaction(
        address target,
        uint256 value,
        bytes memory data
    ) external payable onlyRole(DEFAULT_ADMIN_ROLE) returns (bytes memory) {
        (bool success, bytes memory returnData) = target.call{value: value}(
            data
        );
        require(success, "!reverted");
        return returnData;
    }

    function addVault(IStrategy strategy, uint16 performanceFeeBP)
        external
        onlyRole(ADD_VAULT_ROLE)
    {
        vaultChef.addVault(strategy, performanceFeeBP);
    }

    function setVault(uint256 vaultId, uint16 performanceFeeBP)
        external
        onlyRole(SET_VAULT_ROLE)
    {
        vaultChef.setVault(vaultId, performanceFeeBP);
    }

    function panicVault(uint256 vaultId) external onlyRole(PAUSE_VAULT_ROLE) {
        vaultChef.panicVault(vaultId);
    }

    function pauseVault(uint256 vaultId, bool paused)
        external
        onlyRole(PAUSE_VAULT_ROLE)
    {
        vaultChef.pauseVault(vaultId, paused);
    }

    function setPullDepositor(address pullDepositor, bool isAllowed)
        external
        onlyRole(DEFAULT_ADMIN_ROLE)
    {
        vaultChef.setPullDepositor(pullDepositor, isAllowed);
    }

    function inCaseTokensGetStuck(IERC20 token, address to)
        external
        onlyRole(DEFAULT_ADMIN_ROLE)
    {
        vaultChef.inCaseTokensGetStuck(token, to);
    }

    function inCaseVaultTokensGetStuck(
        uint256 vaultId,
        IERC20 token,
        address to,
        uint256 amount
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        vaultChef.inCaseVaultTokensGetStuck(vaultId, token, to, amount);
    }

    function transferAllFees(address to) external onlyRole(FEE_PROCESSOR_ROLE) {
        transferFeesBatch(0, vaultChef.poolLength(), to);
    }

    function transferFeesBatch(
        uint256 fromId,
        uint256 length,
        address to
    ) public onlyRole(FEE_PROCESSOR_ROLE) {
        uint256[] memory ids = new uint256[](length);
        address[] memory accounts = new address[](length);
        for (uint256 i = 0; i < length; i++) {
            ids[i] = fromId + i;
            accounts[i] = address(this);
        }
        uint256[] memory amounts = vaultChef.balanceOfBatch(accounts, ids);
        vaultChef.safeBatchTransferFrom(address(this), to, ids, amounts, "");

        emit FeesTransferred(fromId, length, to);
    }

    function changeMetadata(
        string memory newName,
        string memory newSymbol,
        uint8 newDecimals
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        vaultChef.changeMetadata(newName, newSymbol, newDecimals);
    }

    function setURI(string memory newURI)
        external
        onlyRole(DEFAULT_ADMIN_ROLE)
    {
        vaultChef.setURI(newURI);
    }

    function transferOwnership() public onlyRole(DEFAULT_ADMIN_ROLE) {
        _transferOwnership();
    }

    function _transferOwnership() internal {
        IOwnable(address(vaultChef)).transferOwnership();
    }

    function onERC1155Received(
        address /*operator*/,
        address /*from*/,
        uint256 /*id*/,
        uint256 /*value*/,
        bytes calldata /*data*/
    ) external override pure returns (bytes4) {
        return IERC1155Receiver.onERC1155Received.selector;
    }

    function onERC1155BatchReceived(
        address /*operator*/,
        address /*from*/,
        uint256[] calldata /*ids*/,
        uint256[] calldata /*values*/,
        bytes calldata /*data*/
    ) external override pure returns (bytes4) {
        return IERC1155Receiver.onERC1155BatchReceived.selector;
    }
}
