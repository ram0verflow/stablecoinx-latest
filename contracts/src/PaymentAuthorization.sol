// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";

contract PaymentAuthorization is Ownable {
    struct AuthorizationRecord {
        bytes32 paymentId;
        address sender;
        address receiver;
        uint256 amount;
        address token;
        string corridor;
        string policyVersion;
        bytes32 complianceHash;
        uint256 timestamp;
        bool isActive;
    }

    address public authorizer;
    mapping(bytes32 => AuthorizationRecord) public authorizations;

    event PaymentAuthorized(bytes32 indexed paymentId, address indexed sender, address indexed receiver, uint256 amount);
    event AuthorizationRevoked(bytes32 indexed paymentId);
    event AuthorizerChanged(address indexed oldAuthorizer, address indexed newAuthorizer);

    modifier onlyAuthorizer() {
        require(msg.sender == authorizer, "PaymentAuthorization: only authorizer");
        _;
    }

    constructor(address _authorizer) Ownable(msg.sender) {
        authorizer = _authorizer;
    }

    function setAuthorizer(address _newAuthorizer) external onlyOwner {
        require(_newAuthorizer != address(0), "PaymentAuthorization: zero address");
        address oldAuthorizer = authorizer;
        authorizer = _newAuthorizer;
        emit AuthorizerChanged(oldAuthorizer, _newAuthorizer);
    }

    function authorizePayment(
        bytes32 paymentId,
        address sender,
        address receiver,
        uint256 amount,
        address token,
        string calldata corridor,
        string calldata policyVersion,
        bytes32 complianceHash
    ) external onlyAuthorizer {
        require(!authorizations[paymentId].isActive, "PaymentAuthorization: already authorized");
        
        authorizations[paymentId] = AuthorizationRecord({
            paymentId: paymentId,
            sender: sender,
            receiver: receiver,
            amount: amount,
            token: token,
            corridor: corridor,
            policyVersion: policyVersion,
            complianceHash: complianceHash,
            timestamp: block.timestamp,
            isActive: true
        });

        emit PaymentAuthorized(paymentId, sender, receiver, amount);
    }

    function isAuthorized(bytes32 paymentId) external view returns (bool) {
        return authorizations[paymentId].isActive;
    }

    function revokeAuthorization(bytes32 paymentId) external onlyAuthorizer {
        require(authorizations[paymentId].isActive, "PaymentAuthorization: not authorized or already revoked");
        authorizations[paymentId].isActive = false;
        emit AuthorizationRevoked(paymentId);
    }
}
