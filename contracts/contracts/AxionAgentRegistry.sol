// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title AxionAgentRegistry
/// @notice Registers Axion agent identities and links them to ERC-8004-style
///         on-chain metadata: strategy version, memory root and trust score.
/// @dev    Intentionally simple and hackathon-safe. One owner per agent.
contract AxionAgentRegistry {
    struct Agent {
        uint256 agentId;
        address owner;
        string agentName;
        string metadataURI;
        uint256 strategyVersion;
        bytes32 memoryRoot;
        uint256 trustScore;
        uint256 totalEpochs;
        uint256 createdAt;
        bool exists;
    }

    uint256 public nextAgentId = 1;
    mapping(uint256 => Agent) private agents;
    mapping(address => uint256[]) private ownerAgents;

    event AgentRegistered(
        uint256 indexed agentId,
        address indexed owner,
        string agentName,
        string metadataURI,
        uint256 createdAt
    );
    event MemoryRootUpdated(uint256 indexed agentId, bytes32 oldRoot, bytes32 newRoot);
    event StrategyUpdated(uint256 indexed agentId, uint256 oldVersion, uint256 newVersion);
    event TrustScoreUpdated(uint256 indexed agentId, uint256 oldScore, uint256 newScore);
    event EpochCountIncremented(uint256 indexed agentId, uint256 totalEpochs);

    modifier onlyAgentOwner(uint256 agentId) {
        require(agents[agentId].exists, "Axion: agent does not exist");
        require(agents[agentId].owner == msg.sender, "Axion: not agent owner");
        _;
    }

    /// @notice Register a new Axion agent. Starts with trust score 70.
    function registerAgent(string calldata name, string calldata metadataURI)
        external
        returns (uint256 agentId)
    {
        agentId = nextAgentId++;
        agents[agentId] = Agent({
            agentId: agentId,
            owner: msg.sender,
            agentName: name,
            metadataURI: metadataURI,
            strategyVersion: 1,
            memoryRoot: bytes32(0),
            trustScore: 70,
            totalEpochs: 0,
            createdAt: block.timestamp,
            exists: true
        });
        ownerAgents[msg.sender].push(agentId);
        emit AgentRegistered(agentId, msg.sender, name, metadataURI, block.timestamp);
    }

    function updateMemoryRoot(uint256 agentId, bytes32 newMemoryRoot)
        external
        onlyAgentOwner(agentId)
    {
        bytes32 old = agents[agentId].memoryRoot;
        agents[agentId].memoryRoot = newMemoryRoot;
        emit MemoryRootUpdated(agentId, old, newMemoryRoot);
    }

    function updateStrategyVersion(uint256 agentId, uint256 newVersion)
        external
        onlyAgentOwner(agentId)
    {
        require(newVersion >= agents[agentId].strategyVersion, "Axion: version cannot decrease");
        uint256 old = agents[agentId].strategyVersion;
        agents[agentId].strategyVersion = newVersion;
        emit StrategyUpdated(agentId, old, newVersion);
    }

    function updateTrustScore(uint256 agentId, uint256 newScore)
        external
        onlyAgentOwner(agentId)
    {
        require(newScore <= 100, "Axion: trust score out of range");
        uint256 old = agents[agentId].trustScore;
        agents[agentId].trustScore = newScore;
        emit TrustScoreUpdated(agentId, old, newScore);
    }

    /// @notice Convenience helper used after an epoch is written.
    function incrementEpochCount(uint256 agentId) external onlyAgentOwner(agentId) {
        agents[agentId].totalEpochs += 1;
        emit EpochCountIncremented(agentId, agents[agentId].totalEpochs);
    }

    function getAgent(uint256 agentId) external view returns (Agent memory) {
        require(agents[agentId].exists, "Axion: agent does not exist");
        return agents[agentId];
    }

    function getOwnerAgents(address owner) external view returns (uint256[] memory) {
        return ownerAgents[owner];
    }
}
