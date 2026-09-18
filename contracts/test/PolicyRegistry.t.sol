// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../src/PolicyRegistry.sol";

contract PolicyRegistryTest is Test {
    PolicyRegistry public registry;
    address public admin = address(1);

    function setUp() public {
        registry = new PolicyRegistry(admin);
    }

    function test_register_policy_version() public {
        string memory vHash = "hash123";
        string memory desc = "Policy Version 1";

        vm.prank(admin);
        registry.registerPolicyVersion(vHash, desc);

        PolicyRegistry.PolicyVersion memory v = registry.getPolicyVersion(vHash);
        assertEq(v.versionHash, vHash);
        assertEq(v.description, desc);
        assertTrue(v.isActive);
    }

    function test_get_current_version() public {
        string memory vHash1 = "hash1";
        string memory vHash2 = "hash2";

        vm.startPrank(admin);
        registry.registerPolicyVersion(vHash1, "Desc 1");
        assertEq(registry.getCurrentVersion(), vHash1);

        registry.registerPolicyVersion(vHash2, "Desc 2");
        assertEq(registry.getCurrentVersion(), vHash2);
        vm.stopPrank();
    }
}
