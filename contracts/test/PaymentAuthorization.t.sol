// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../src/PaymentAuthorization.sol";

contract PaymentAuthorizationTest is Test {
    PaymentAuthorization public auth;
    address public admin = address(1);
    address public authorizer = address(2);
    address public sender = address(3);
    address public receiver = address(4);
    address public token = address(5);

    function setUp() public {
        vm.prank(admin);
        auth = new PaymentAuthorization(authorizer);
    }

    function test_authorize_payment_success() public {
        bytes32 paymentId = keccak256("payment1");
        vm.prank(authorizer);
        auth.authorizePayment(
            paymentId,
            sender,
            receiver,
            1000,
            token,
            "US-IN",
            "v1",
            keccak256("compliance")
        );

        assertTrue(auth.isAuthorized(paymentId));
    }

    function test_only_authorizer_can_authorize() public {
        bytes32 paymentId = keccak256("payment1");
        vm.prank(sender);
        vm.expectRevert("PaymentAuthorization: only authorizer");
        auth.authorizePayment(
            paymentId,
            sender,
            receiver,
            1000,
            token,
            "US-IN",
            "v1",
            keccak256("compliance")
        );
    }

    function test_is_authorized_returns_true() public {
        bytes32 paymentId = keccak256("payment1");
        vm.prank(authorizer);
        auth.authorizePayment(
            paymentId,
            sender,
            receiver,
            1000,
            token,
            "US-IN",
            "v1",
            keccak256("compliance")
        );
        assertTrue(auth.isAuthorized(paymentId));
    }

    function test_revoke_authorization() public {
        bytes32 paymentId = keccak256("payment1");
        vm.prank(authorizer);
        auth.authorizePayment(
            paymentId,
            sender,
            receiver,
            1000,
            token,
            "US-IN",
            "v1",
            keccak256("compliance")
        );
        
        vm.prank(authorizer);
        auth.revokeAuthorization(paymentId);
        assertFalse(auth.isAuthorized(paymentId));
    }
}
