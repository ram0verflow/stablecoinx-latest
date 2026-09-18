// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import "../src/MockStablecoinERC20.sol";
import "../src/PaymentAuthorization.sol";
import "../src/SettlementProofRegistry.sol";
import "../src/PolicyRegistry.sol";

contract DeployScript is Script {
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("BACKEND_WALLET_PRIVATE_KEY");
        address backendWallet = vm.envAddress("BACKEND_WALLET_ADDRESS");

        vm.startBroadcast(deployerPrivateKey);

        // Deploy Mock USDC
        MockStablecoinERC20 usdc = new MockStablecoinERC20("Mock USDC", "USDC", 6);
        console.log("MockUSDC deployed at:", address(usdc));

        // Deploy Mock USDT
        MockStablecoinERC20 usdt = new MockStablecoinERC20("Mock USDT", "USDT", 6);
        console.log("MockUSDT deployed at:", address(usdt));

        // Deploy PaymentAuthorization
        PaymentAuthorization auth = new PaymentAuthorization(backendWallet);
        console.log("PaymentAuthorization deployed at:", address(auth));

        // Deploy SettlementProofRegistry
        SettlementProofRegistry proofRegistry = new SettlementProofRegistry(backendWallet);
        console.log("SettlementProofRegistry deployed at:", address(proofRegistry));

        // Deploy PolicyRegistry
        PolicyRegistry policyRegistry = new PolicyRegistry(backendWallet);
        console.log("PolicyRegistry deployed at:", address(policyRegistry));

        // Mint 1,000,000 tokens to backend wallet (1,000,000 * 10^6)
        usdc.mint(backendWallet, 1_000_000 * 10**6);
        usdt.mint(backendWallet, 1_000_000 * 10**6);

        vm.stopBroadcast();
        
        console.log("Deployment complete.");
    }
}
