// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface IERC20 {
    function transfer(address to, uint256 value) external returns (bool);
    function transferFrom(address from, address to, uint256 value) external returns (bool);
    function balanceOf(address account) external view returns (uint256);
}

/// @title AxionYieldVault
/// @notice A REAL on-chain yield vault that Axion deposits into when it executes
///         a selected branch. Deposits charge an on-chain entry fee (the
///         realised "slippage") and accrue linear APY over time. Yield is paid
///         from a reward reserve the deployer funds. This is the contract that
///         turns Axion's execution step from a simulation into a verifiable
///         on-chain action.
contract AxionYieldVault {
    IERC20 public immutable asset;
    string public vaultName;
    string public riskTag; // "safe" | "unsafe" — surfaced to the agent's RiskCheck
    uint256 public immutable apyBps; // realised APY in basis points (e.g. 560 = 5.60%)
    uint256 public immutable depositFeeBps; // entry fee in bps (the realised slippage)
    address public owner;

    uint256 private constant YEAR = 365 days;

    struct Position {
        uint256 principal; // net credited after fee
        uint256 since; // last accrual timestamp
        uint256 realizedYield; // accrued yield not yet withdrawn
    }

    mapping(address => Position) public positions;
    uint256 public totalPrincipal;

    event Deposited(address indexed user, uint256 assetsIn, uint256 fee, uint256 credited);
    event Withdrawn(address indexed user, uint256 principal, uint256 yield, uint256 paid);
    event RewardsFunded(address indexed from, uint256 amount);

    constructor(
        address asset_,
        string memory vaultName_,
        string memory riskTag_,
        uint256 apyBps_,
        uint256 depositFeeBps_
    ) {
        require(asset_ != address(0), "Vault: zero asset");
        require(depositFeeBps_ < 10_000, "Vault: fee too high");
        asset = IERC20(asset_);
        vaultName = vaultName_;
        riskTag = riskTag_;
        apyBps = apyBps_;
        depositFeeBps = depositFeeBps_;
        owner = msg.sender;
    }

    /// @notice The realised terms the agent verifies against its prediction.
    function quote()
        external
        view
        returns (uint256 apyBps_, uint256 depositFeeBps_, string memory riskTag_)
    {
        return (apyBps, depositFeeBps, riskTag);
    }

    /// @notice Deposit `assets` of the underlying. An entry fee is taken; the net
    ///         amount becomes the caller's principal. Returns the net credited.
    function deposit(uint256 assets) external returns (uint256 credited) {
        require(assets > 0, "Vault: zero deposit");
        require(asset.transferFrom(msg.sender, address(this), assets), "Vault: transfer failed");

        uint256 fee = (assets * depositFeeBps) / 10_000;
        credited = assets - fee;

        _accrue(msg.sender);
        positions[msg.sender].principal += credited;
        totalPrincipal += credited;

        emit Deposited(msg.sender, assets, fee, credited);
    }

    /// @notice Withdraw the caller's full principal plus accrued yield.
    function withdraw() external returns (uint256 paid) {
        _accrue(msg.sender);
        Position storage p = positions[msg.sender];
        uint256 principal = p.principal;
        uint256 yield = p.realizedYield;
        paid = principal + yield;
        require(paid > 0, "Vault: nothing to withdraw");

        totalPrincipal -= principal;
        p.principal = 0;
        p.realizedYield = 0;
        p.since = block.timestamp;

        require(asset.balanceOf(address(this)) >= paid, "Vault: insufficient reserve");
        require(asset.transfer(msg.sender, paid), "Vault: payout failed");

        emit Withdrawn(msg.sender, principal, yield, paid);
    }

    /// @notice Live accrued yield for a user (view — does not mutate state).
    function accruedYield(address user) public view returns (uint256) {
        Position memory p = positions[user];
        if (p.principal == 0 || p.since == 0) return p.realizedYield;
        uint256 elapsed = block.timestamp - p.since;
        return p.realizedYield + (p.principal * apyBps * elapsed) / (10_000 * YEAR);
    }

    /// @notice Full position snapshot used by the frontend's outcome verifier.
    function positionOf(address user)
        external
        view
        returns (uint256 principal, uint256 since, uint256 accrued)
    {
        Position memory p = positions[user];
        return (p.principal, p.since, accruedYield(user));
    }

    /// @notice Anyone (typically the deployer) can top up the yield reserve.
    function fundRewards(uint256 amount) external {
        require(asset.transferFrom(msg.sender, address(this), amount), "Vault: fund failed");
        emit RewardsFunded(msg.sender, amount);
    }

    function _accrue(address user) internal {
        Position storage p = positions[user];
        if (p.principal > 0 && p.since > 0) {
            uint256 elapsed = block.timestamp - p.since;
            p.realizedYield += (p.principal * apyBps * elapsed) / (10_000 * YEAR);
        }
        p.since = block.timestamp;
    }
}
