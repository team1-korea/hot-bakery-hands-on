# Avalanche Bakery Certificate

`AvalancheBakeryCertificate` is an ERC-721 Metadata-compatible, EIP-5192 soulbound participation certificate for
Avalanche Bakery. Token IDs begin at 1, each token stores an immutable-per-issuance metadata URI, and ordinary minting
is limited to one issuance per recipient address.

## Policy

- Certificates are permanently locked. All holder-to-holder `transferFrom` and `safeTransferFrom` calls revert.
- `approve` and `setApprovalForAll` also revert; read-only approval functions remain ERC-721 compatible.
- `MINTER_ROLE` may mint individually or atomically in batches of at most 50.
- `RECOVERY_ROLE` may revoke any holder's certificate. This is an administrator-recoverable SBT, not a holder-controlled
  burn model.
- A revoked token ID grants exactly one reissue. Reissue always creates a new sequential token ID and can target the same
  wallet or a replacement wallet that currently holds no certificate.
- Metadata has no update endpoint. Correcting metadata requires revocation followed by reissue.
- Minting uses ERC-721 receiver checks. A contract wallet that does not implement `onERC721Received` cannot receive a
  certificate, and including one in a batch causes the entire atomic batch to revert. Validate batch recipients before
  submission.

The constructor grants `DEFAULT_ADMIN_ROLE` and `RECOVERY_ROLE` to the admin address, and only `MINTER_ROLE` to the
initial server minter. It does not grant the admin mint permission automatically.

프론트엔드와 백엔드 호출 방법은 [INTEGRATION_GUIDE.md](./INTEGRATION_GUIDE.md)를 참고하세요.

Fuji 테스트넷 검증 결과는 [FUJI_SMOKE_TEST.md](./FUJI_SMOKE_TEST.md)에 기록되어 있습니다.

## Operational safety

- Never call `renounceRole(DEFAULT_ADMIN_ROLE, admin)`. If the last default admin renounces the role, role management is
  permanently disabled and the contract has no recovery path.
- To rotate the administrator, first grant `DEFAULT_ADMIN_ROLE` and `RECOVERY_ROLE` to the new address, verify both
  grants on-chain, and only then revoke those roles from the previous address.

## Development

Requirements: Foundry, Solidity 0.8.24, OpenZeppelin Contracts 5.x.

Install the pinned dependencies after cloning the repository:

```bash
forge install OpenZeppelin/openzeppelin-contracts@v5.1.0 --no-git
forge install foundry-rs/forge-std@v1.9.4 --no-git
```

```bash
forge fmt --check
forge build
forge test --offline
```

## Deployment

Copy `.env.example` to a local `.env`, supply the deployer private key and the two operational addresses, then load the
environment without committing it:

```dotenv
PRIVATE_KEY=
ADMIN_ADDRESS=
MINTER_ADDRESS=
```

Deploy to Fuji (chain ID `43113`) or Avalanche C-Chain mainnet (chain ID `43114`) by providing the RPC URL at the command
line:

```bash
forge script script/Deploy.s.sol:Deploy --rpc-url "$RPC_URL" --broadcast
```

The script refuses chains other than Fuji and Avalanche C-Chain mainnet, verifies all three initial role assignments,
and prints the deployed address and verification results. It never logs the private key.
