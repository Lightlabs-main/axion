// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title EpochMemoryLog
/// @notice Stores judged epochs after execution. Each epoch is a verifiable
///         post-mortem that links a prior commitment to its real outcome and
///         the resulting strategy / memory evolution.
contract EpochMemoryLog {
    enum Verdict {
        Correct,
        PartiallyCorrect,
        Wrong,
        RejectedSafely,
        UnsafeBlocked
    }

    struct Epoch {
        uint256 epochId;
        uint256 agentId;
        uint256 commitmentId;
        bytes32 actionHash;
        bytes32 outcomeHash;
        bytes32 postMortemHash;
        Verdict verdict;
        uint256 score;
        bytes32 newMemoryRoot;
        uint256 newStrategyVersion;
        uint256 timestamp;
        bool exists;
    }

    uint256 public nextEpochId = 1;
    mapping(uint256 => Epoch) private epochs;
    mapping(uint256 => uint256[]) private agentEpochs;

    event EpochWritten(
        uint256 indexed epochId,
        uint256 indexed agentId,
        uint256 indexed commitmentId,
        Verdict verdict,
        uint256 score,
        bytes32 newMemoryRoot,
        uint256 newStrategyVersion,
        uint256 timestamp
    );

    function writeEpoch(
        uint256 agentId,
        uint256 commitmentId,
        bytes32 actionHash,
        bytes32 outcomeHash,
        bytes32 postMortemHash,
        Verdict verdict,
        uint256 score,
        bytes32 newMemoryRoot,
        uint256 newStrategyVersion
    ) external returns (uint256 epochId) {
        epochId = nextEpochId++;
        epochs[epochId] = Epoch({
            epochId: epochId,
            agentId: agentId,
            commitmentId: commitmentId,
            actionHash: actionHash,
            outcomeHash: outcomeHash,
            postMortemHash: postMortemHash,
            verdict: verdict,
            score: score,
            newMemoryRoot: newMemoryRoot,
            newStrategyVersion: newStrategyVersion,
            timestamp: block.timestamp,
            exists: true
        });
        agentEpochs[agentId].push(epochId);
        emit EpochWritten(
            epochId,
            agentId,
            commitmentId,
            verdict,
            score,
            newMemoryRoot,
            newStrategyVersion,
            block.timestamp
        );
    }

    function getEpoch(uint256 epochId) external view returns (Epoch memory) {
        require(epochs[epochId].exists, "Axion: epoch does not exist");
        return epochs[epochId];
    }

    function getAgentEpochs(uint256 agentId) external view returns (uint256[] memory) {
        return agentEpochs[agentId];
    }
}
