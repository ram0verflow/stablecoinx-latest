// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";

contract PolicyRegistry is Ownable {
    struct PolicyVersion {
        string versionHash;
        string description;
        uint256 timestamp;
        bool isActive;
    }

    string public currentVersion;
    mapping(string => PolicyVersion) public versions;

    event PolicyVersionRegistered(string versionHash, string description);
    event PolicyVersionActivated(string versionHash);

    constructor(address initialAdmin) Ownable(initialAdmin) {}

    function registerPolicyVersion(string calldata versionHash, string calldata description) external onlyOwner {
        require(bytes(versionHash).length > 0, "PolicyRegistry: empty version hash");
        require(!versions[versionHash].isActive, "PolicyRegistry: version already exists");

        versions[versionHash] = PolicyVersion({
            versionHash: versionHash,
            description: description,
            timestamp: block.timestamp,
            isActive: true
        });

        currentVersion = versionHash;

        emit PolicyVersionRegistered(versionHash, description);
        emit PolicyVersionActivated(versionHash);
    }

    function getPolicyVersion(string calldata versionHash) external view returns (PolicyVersion memory) {
        require(versions[versionHash].isActive, "PolicyRegistry: version does not exist");
        return versions[versionHash];
    }

    function getCurrentVersion() external view returns (string memory) {
        return currentVersion;
    }
}
