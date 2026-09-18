// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";

contract SettlementProofRegistry is Ownable {
    struct ProofRecord {
        bytes32 paymentId;
        bytes32 txHash;
        bytes32 zkProofHash;
        string aiDecision;
        string policyVersion;
        uint256 amount;
        address token;
        uint256 timestamp;
        address registrar;
    }

    address public registrar;
    mapping(bytes32 => ProofRecord) public proofs;

    event ProofRegistered(bytes32 indexed paymentId, bytes32 indexed txHash, bytes32 indexed zkProofHash);
    event RegistrarChanged(address indexed oldRegistrar, address indexed newRegistrar);

    modifier onlyRegistrar() {
        require(msg.sender == registrar, "SettlementProofRegistry: only registrar");
        _;
    }

    constructor(address _registrar) Ownable(msg.sender) {
        registrar = _registrar;
    }

    function setRegistrar(address _newRegistrar) external onlyOwner {
        require(_newRegistrar != address(0), "SettlementProofRegistry: zero address");
        address oldRegistrar = registrar;
        registrar = _newRegistrar;
        emit RegistrarChanged(oldRegistrar, _newRegistrar);
    }

    function registerProof(
        bytes32 paymentId,
        bytes32 txHash,
        bytes32 zkProofHash,
        string calldata aiDecision,
        string calldata policyVersion,
        uint256 amount,
        address token
    ) external onlyRegistrar {
        require(proofs[paymentId].paymentId == bytes32(0), "SettlementProofRegistry: proof already exists");

        proofs[paymentId] = ProofRecord({
            paymentId: paymentId,
            txHash: txHash,
            zkProofHash: zkProofHash,
            aiDecision: aiDecision,
            policyVersion: policyVersion,
            amount: amount,
            token: token,
            timestamp: block.timestamp,
            registrar: msg.sender
        });

        emit ProofRegistered(paymentId, txHash, zkProofHash);
    }

    function getProof(bytes32 paymentId) external view returns (ProofRecord memory) {
        require(proofs[paymentId].paymentId != bytes32(0), "SettlementProofRegistry: proof does not exist");
        return proofs[paymentId];
    }

    function proofExists(bytes32 paymentId) external view returns (bool) {
        return proofs[paymentId].paymentId != bytes32(0);
    }
}
