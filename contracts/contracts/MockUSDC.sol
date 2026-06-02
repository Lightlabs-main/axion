// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title MockUSDC
/// @notice A real, self-contained ERC-20 used as Axion's test USDC on Mantle.
///         6 decimals to mirror real USDC. Anyone can mint from the faucet so a
///         demo wallet can fund itself; mainnet deployments can renounce the
///         faucet by setting `faucetCap` to 0 via `setFaucetCap`.
/// @dev    No external dependencies — minimal ERC-20 implemented inline so the
///         build never depends on an external package install.
contract MockUSDC {
    string public constant name = "Axion Test USDC";
    string public constant symbol = "aUSDC";
    uint8 public constant decimals = 6;

    uint256 public totalSupply;
    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;

    address public owner;
    /// @notice Max tokens mintable per faucet call (0 disables the faucet).
    uint256 public faucetCap = 10_000 * 1e6; // 10,000 aUSDC

    event Transfer(address indexed from, address indexed to, uint256 value);
    event Approval(address indexed owner, address indexed spender, uint256 value);
    event FaucetCapUpdated(uint256 newCap);

    constructor() {
        owner = msg.sender;
    }

    modifier onlyOwner() {
        require(msg.sender == owner, "MockUSDC: not owner");
        _;
    }

    function transfer(address to, uint256 value) external returns (bool) {
        _transfer(msg.sender, to, value);
        return true;
    }

    function approve(address spender, uint256 value) external returns (bool) {
        allowance[msg.sender][spender] = value;
        emit Approval(msg.sender, spender, value);
        return true;
    }

    function transferFrom(address from, address to, uint256 value) external returns (bool) {
        uint256 allowed = allowance[from][msg.sender];
        if (allowed != type(uint256).max) {
            require(allowed >= value, "MockUSDC: insufficient allowance");
            allowance[from][msg.sender] = allowed - value;
        }
        _transfer(from, to, value);
        return true;
    }

    /// @notice Owner mint — used by the deploy script to seed wallets and vault
    ///         reward reserves.
    function mint(address to, uint256 value) external onlyOwner {
        _mint(to, value);
    }

    /// @notice Permissionless faucet so a fresh demo wallet can fund itself with
    ///         test USDC. Capped per call by `faucetCap`.
    function faucet(uint256 value) external {
        require(faucetCap > 0, "MockUSDC: faucet disabled");
        require(value <= faucetCap, "MockUSDC: over faucet cap");
        _mint(msg.sender, value);
    }

    function setFaucetCap(uint256 newCap) external onlyOwner {
        faucetCap = newCap;
        emit FaucetCapUpdated(newCap);
    }

    function _transfer(address from, address to, uint256 value) internal {
        require(to != address(0), "MockUSDC: zero address");
        require(balanceOf[from] >= value, "MockUSDC: insufficient balance");
        unchecked {
            balanceOf[from] -= value;
            balanceOf[to] += value;
        }
        emit Transfer(from, to, value);
    }

    function _mint(address to, uint256 value) internal {
        require(to != address(0), "MockUSDC: zero address");
        totalSupply += value;
        unchecked {
            balanceOf[to] += value;
        }
        emit Transfer(address(0), to, value);
    }
}
