// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../src/MockStablecoinERC20.sol";

contract MockStablecoinERC20Test is Test {
    MockStablecoinERC20 public token;
    address public owner = address(1);
    address public user = address(2);

    function setUp() public {
        vm.prank(owner);
        token = new MockStablecoinERC20("Mock USDC", "USDC", 6);
    }

    function test_mint_to_address() public {
        vm.prank(owner);
        token.mint(user, 1000);
        assertEq(token.balanceOf(user), 1000);
    }

    function test_only_owner_can_mint() public {
        vm.prank(user);
        vm.expectRevert(); // OwnableUnauthorizedAccount
        token.mint(user, 1000);
    }

    function test_transfer() public {
        vm.prank(owner);
        token.mint(user, 1000);
        
        vm.prank(user);
        token.transfer(address(3), 400);
        
        assertEq(token.balanceOf(user), 600);
        assertEq(token.balanceOf(address(3)), 400);
    }
}
