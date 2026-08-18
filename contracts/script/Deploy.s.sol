// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Script, console2} from "forge-std/Script.sol";

import {AvalancheBakeryCertificate} from "../src/AvalancheBakeryCertificate.sol";

/// @notice Deploys AvalancheBakeryCertificate using separated administration and minting wallets.
contract Deploy is Script {
    error UnsupportedChain(uint256 chainId);
    error RoleVerificationFailed();

    function run() external returns (AvalancheBakeryCertificate certificate) {
        if (block.chainid != 43113 && block.chainid != 43114) revert UnsupportedChain(block.chainid);

        uint256 privateKey = vm.envUint("PRIVATE_KEY");
        address admin = vm.envAddress("ADMIN_ADDRESS");
        address minter = vm.envAddress("MINTER_ADDRESS");

        vm.startBroadcast(privateKey);
        certificate = new AvalancheBakeryCertificate(admin, minter);
        vm.stopBroadcast();

        bool adminIsAdmin = certificate.hasRole(certificate.DEFAULT_ADMIN_ROLE(), admin);
        bool adminIsRecovery = certificate.hasRole(certificate.RECOVERY_ROLE(), admin);
        bool minterCanMint = certificate.hasRole(certificate.MINTER_ROLE(), minter);

        if (!adminIsAdmin || !adminIsRecovery || !minterCanMint) revert RoleVerificationFailed();

        console2.log("AvalancheBakeryCertificate:", address(certificate));
        console2.log("Admin has DEFAULT_ADMIN_ROLE:", adminIsAdmin);
        console2.log("Admin has RECOVERY_ROLE:", adminIsRecovery);
        console2.log("Minter has MINTER_ROLE:", minterCanMint);
    }
}
