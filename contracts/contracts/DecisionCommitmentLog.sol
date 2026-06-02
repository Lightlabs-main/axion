// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title DecisionCommitmentLog
/// @notice Stores pre-execution decision-tree commitments so an agent can never
///         rewrite its reasoning after the fact. Hashes are committed BEFORE
///         any action is taken.
contract DecisionCommitmentLog {
    struct Commitment {
        uint256 commitmentId;
        uint256 agentId;
        bytes32 goalHash;
        bytes32 treeHash;
        bytes32 selectedBranchHash;
        bytes32 policyHash;
        uint256 strategyVersion;
        uint256 timestamp;
        address committer;
        bool exists;
    }

    uint256 public nextCommitmentId = 1;
    mapping(uint256 => Commitment) private commitments;
    mapping(uint256 => uint256[]) private agentCommitments;

    event DecisionTreeCommitted(
        uint256 indexed commitmentId,
        uint256 indexed agentId,
        bytes32 goalHash,
        bytes32 treeHash,
        bytes32 selectedBranchHash,
        bytes32 policyHash,
        uint256 strategyVersion,
        uint256 timestamp
    );

    function commitDecisionTree(
        uint256 agentId,
        bytes32 goalHash,
        bytes32 treeHash,
        bytes32 selectedBranchHash,
        bytes32 policyHash,
        uint256 strategyVersion
    ) external returns (uint256 commitmentId) {
        commitmentId = nextCommitmentId++;
        commitments[commitmentId] = Commitment({
            commitmentId: commitmentId,
            agentId: agentId,
            goalHash: goalHash,
            treeHash: treeHash,
            selectedBranchHash: selectedBranchHash,
            policyHash: policyHash,
            strategyVersion: strategyVersion,
            timestamp: block.timestamp,
            committer: msg.sender,
            exists: true
        });
        agentCommitments[agentId].push(commitmentId);
        emit DecisionTreeCommitted(
            commitmentId,
            agentId,
            goalHash,
            treeHash,
            selectedBranchHash,
            policyHash,
            strategyVersion,
            block.timestamp
        );
    }

    function getCommitment(uint256 commitmentId) external view returns (Commitment memory) {
        require(commitments[commitmentId].exists, "Axion: commitment does not exist");
        return commitments[commitmentId];
    }

    function getAgentCommitments(uint256 agentId) external view returns (uint256[] memory) {
        return agentCommitments[agentId];
    }
}
