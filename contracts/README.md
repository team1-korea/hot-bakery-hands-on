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

## Integration artifacts

- ABI: [`abi/AvalancheBakeryCertificate.json`](./abi/AvalancheBakeryCertificate.json)
- Fuji deployment: [`deployments/43113.json`](./deployments/43113.json)
- Mainnet deployment: [`deployments/43114.json`](./deployments/43114.json)
  (`0x787D2971Ec3eaA6b63d51BB52834aB41d2cd18A9`, 온체인 코드·트랜잭션·역할 검증 완료)
- ABI regeneration: `./scripts/export-abi.sh`

The frontend and backend should use the committed ABI rather than importing the full Foundry `out/` artifact. Whenever
the contract interface changes, regenerate the ABI and commit it with the Solidity change.

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

메인넷 배포 뒤에는 `apps/web`에서 공개 배포 정보와 권한을 온체인 결과와 대조해 기록합니다. `--minter`에는
Vercel의 기존 `MINTER_PRIVATE_KEY`에서 파생된 운영 민터 주소를 그대로 사용합니다.

```bash
cd ../apps/web
npm run chain:record-mainnet -- --address 0x... --tx 0x... --block 12345678 \
  --admin 0x... --minter 0x...
npm run chain:record-mainnet -- --address 0x... --tx 0x... --block 12345678 \
  --admin 0x... --minter 0x... --apply --confirm RECORD
```

생성된 `deployments/43114.json`은 주소·트랜잭션·블록·역할 보유 주소만 담는 공개 기록입니다. 개인키는
기록하지 않습니다.
