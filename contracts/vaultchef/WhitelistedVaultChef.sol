import "./VaultChef.sol";
contract WhitelistedVaultChef is VaultChef {
    mapping(address => bool) public whitelisted;
    address[] public whitelist;

    event UserWhitelisted(address indexed user);

    constructor(address _owner) VaultChef(_owner) {
        // Required for minting and burning
        _addToWhitelist(address(this));
        _addToWhitelist(address(0));
    }

    modifier onlyWhitelisted() {
        require(whitelisted[msg.sender], "!not whitelisted");
        _;
    }
    function addToWhitelist(address user) public onlyOwner {
        _addToWhitelist(user);
    }


    function addMultipleToWhitelist(address[] calldata users) external onlyOwner {
        for(uint256 i = 0; i < users.length; i++) {
            _addToWhitelist(users[i]);
        }
    }


    function _addToWhitelist(address user) internal {
        require(!whitelisted[user], "!already whitelisted");
        whitelisted[user] = true;
        whitelist.push(user);

        emit UserWhitelisted(user);
    }
    function depositUnderlying(
        uint256 vaultId,
        uint256 underlyingAmount,
        bool pulled,
        uint256 minSharesReceived
    ) public override onlyWhitelisted returns (uint256 sharesReceived) {
        return super.depositUnderlying(vaultId, underlyingAmount, pulled, minSharesReceived);
    }

    function withdrawShares(
        uint256 vaultId,
        uint256 shares,
        uint256 minUnderlyingReceived
    ) public override onlyWhitelisted returns (uint256 underlyingReceived) {
        return super.withdrawShares(vaultId, shares, minUnderlyingReceived);
    }

    function withdrawSharesTo(
        uint256 vaultId,
        uint256 shares,
        uint256 minUnderlyingReceived,
        address to
    ) public override onlyWhitelisted returns (uint256 underlyingReceived) {
        require(whitelisted[to], "!to not whitelisted");
        return super.withdrawSharesTo(vaultId, shares, minUnderlyingReceived, to);
    }

    function harvest(uint256 vaultId) public override onlyWhitelisted returns (uint256 underlyingIncrease) {
        return super.harvest(vaultId);
    }

    function deposit(uint256 _pid, uint256 _amount) public override onlyWhitelisted {
        super.deposit(_pid, _amount);
    }

    function withdraw(uint256 _pid, uint256 _amount) public override onlyWhitelisted {
        super.withdraw(_pid, _amount);
    }

    function emergencyWithdraw(uint256 _pid) public override onlyWhitelisted {
        super.emergencyWithdraw(_pid);
    }
    function _beforeTokenTransfer(
        address operator,
        address from,
        address to,
        uint256[] memory ids,
        uint256[] memory amounts,
        bytes memory data
    ) internal override onlyWhitelisted {
        require(whitelisted[from], "!from not whitelisted");
        require(whitelisted[to], "!to not whitelisted");
        super._beforeTokenTransfer(operator, from, to, ids, amounts, data);
    }

    function whitelistLength() external view returns (uint256) {
        return whitelist.length;
    }
}