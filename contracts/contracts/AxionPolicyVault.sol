// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title AxionPolicyVault
/// @notice Represents an agent's wallet policy / permissions. Used by Axion to
///         decide whether a candidate action is allowed before execution.
contract AxionPolicyVault {
    struct Policy {
        uint256 maxSpend; // in smallest token units (e.g. 6-decimals USDC)
        uint256 maxSlippageBps; // basis points, 100 = 1%
        bool allowUnsafeApprovals;
        bool isPaused;
        bool exists;
    }

    // agentId => policy
    mapping(uint256 => Policy) private policies;
    // agentId => allowed asset symbols / protocol names
    mapping(uint256 => string[]) private allowedAssets;
    mapping(uint256 => string[]) private allowedProtocols;
    // agentId => owner
    mapping(uint256 => address) public policyOwner;

    event PolicySet(
        uint256 indexed agentId,
        uint256 maxSpend,
        uint256 maxSlippageBps,
        bool allowUnsafeApprovals
    );
    event PolicyPaused(uint256 indexed agentId);
    event PolicyUnpaused(uint256 indexed agentId);

    modifier onlyPolicyOwner(uint256 agentId) {
        require(
            policyOwner[agentId] == address(0) || policyOwner[agentId] == msg.sender,
            "Axion: not policy owner"
        );
        _;
    }

    function setPolicy(
        uint256 agentId,
        uint256 maxSpend,
        uint256 maxSlippageBps,
        bool allowUnsafeApprovals,
        string[] calldata assets,
        string[] calldata protocols
    ) external onlyPolicyOwner(agentId) {
        if (policyOwner[agentId] == address(0)) {
            policyOwner[agentId] = msg.sender;
        }
        policies[agentId] = Policy({
            maxSpend: maxSpend,
            maxSlippageBps: maxSlippageBps,
            allowUnsafeApprovals: allowUnsafeApprovals,
            isPaused: false,
            exists: true
        });
        delete allowedAssets[agentId];
        for (uint256 i = 0; i < assets.length; i++) {
            allowedAssets[agentId].push(assets[i]);
        }
        delete allowedProtocols[agentId];
        for (uint256 i = 0; i < protocols.length; i++) {
            allowedProtocols[agentId].push(protocols[i]);
        }
        emit PolicySet(agentId, maxSpend, maxSlippageBps, allowUnsafeApprovals);
    }

    /// @notice Pure on-chain policy check used before execution.
    /// @return ok        whether the action passes policy
    /// @return reasonCode 0 = ok, 1 = paused, 2 = spend, 3 = slippage, 4 = unsafe approval
    function checkPolicy(
        uint256 agentId,
        uint256 spend,
        uint256 slippageBps,
        bool requiresUnsafeApproval
    ) external view returns (bool ok, uint8 reasonCode) {
        Policy memory p = policies[agentId];
        if (!p.exists) {
            return (false, 5); // no policy set
        }
        if (p.isPaused) {
            return (false, 1);
        }
        if (spend > p.maxSpend) {
            return (false, 2);
        }
        if (slippageBps > p.maxSlippageBps) {
            return (false, 3);
        }
        if (requiresUnsafeApproval && !p.allowUnsafeApprovals) {
            return (false, 4);
        }
        return (true, 0);
    }

    function getPolicy(uint256 agentId) external view returns (Policy memory) {
        return policies[agentId];
    }

    function getAllowedAssets(uint256 agentId) external view returns (string[] memory) {
        return allowedAssets[agentId];
    }

    function getAllowedProtocols(uint256 agentId) external view returns (string[] memory) {
        return allowedProtocols[agentId];
    }

    function pause(uint256 agentId) external onlyPolicyOwner(agentId) {
        require(policies[agentId].exists, "Axion: no policy");
        policies[agentId].isPaused = true;
        emit PolicyPaused(agentId);
    }

    function unpause(uint256 agentId) external onlyPolicyOwner(agentId) {
        require(policies[agentId].exists, "Axion: no policy");
        policies[agentId].isPaused = false;
        emit PolicyUnpaused(agentId);
    }
}
