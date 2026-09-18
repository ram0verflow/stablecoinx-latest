// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../src/SettlementProofRegistry.sol";

contract SettlementProofRegistryTest is Test {
    SettlementProofRegistry public registry;
    address public admin = address(1);
    address public registrar = address(2);
    address public token = address(5);

    function setUp() public {
        vm.prank(admin);
        registry = new SettlementProofRegistry(registrar);
    }

    function test_register_proof_success() public {
        bytes32 paymentId = keccak256("payment1");
        bytes32 txHash = keccak256("tx1");
        bytes32 zkHash = keccak256("zk1");

        vm.prank(registrar);
        registry.registerProof(
            paymentId,
            txHash,
            zkHash,
            "ALLOWED",
            "v1",
            1000,
            token
        );

        assertTrue(registry.proofExists(paymentId));
    }

    function test_proof_exists_true() public {
        bytes32 paymentId = keccak256("payment1");
        bytes32 txHash = keccak256("tx1");
        bytes32 zkHash = keccak256("zk1");

        vm.prank(registrar);
        registry.registerProof(
            paymentId,
            txHash,
            zkHash,
            "ALLOWED",
            "v1",
            1000,
            token
        );

        assertTrue(registry.proofExists(paymentId));
    }

    function test_get_proof_returns_correct_data() public {
        bytes32 paymentId = keccak256("payment1");
        bytes32 txHash = keccak256("tx1");
        bytes32 zkHash = keccak256("zk1");

        vm.prank(registrar);
        registry.registerProof(
            paymentId,
            txHash,
            zkHash,
            "ALLOWED",
            "v1",
            1000,
            token
        );

        SettlementProofRegistry.ProofRecord memory proof = registry.getProof(paymentId);
        assertEq(proof.paymentId, paymentId);
        assertEq(proof.txHash, txHash);
        assertEq(proof.zkProofHash, zkHash);
        assertEq(proof.amount, 1000);
        assertEq(proof.token, token);
    }
}
