# Fuji Smoke Test Result

- Date: 2026-08-18
- Network: Avalanche Fuji C-Chain (`43113`)
- Contract: `0x67Ce0bb25ee58B6D000d209B051b9E846D0d6b36`
- Admin/Recovery: `0x7a227D5902cA52C0C3C61304533bfF4632Fce145`
- Minter: `0x10dD14002A7EfFAEb52272BC2e04a6113d0ff608`

This is a test deployment. The metadata URIs used below are smoke-test placeholders, not production metadata.

## Transactions

| Action | Transaction hash | Result |
|---|---|---|
| Fund minter with 0.05 AVAX | `0x25bdea9460db20af08ede5882694e3c475b9204781256842d025fa89905a2cbc` | Success |
| Deploy contract | `0xbea5a4290538de403ff2e892808e02d65eaec0ae9463711f77525a03af65974a` | Success |
| Single mint, Token ID 1 | `0xf3b9be8944f1bdca715bbdbf0058fd4dd9834c6ae680b6aaa3be185706372871` | Success |
| Batch mint, Token IDs 2 and 3 | `0x3b351dbc9bdfb2771154ed52bfe9e11268fb2cc1f6c39d823dafffe40705b294` | Success |
| Admin burn, Token ID 1 | `0xc58e88a1ef1d5ce5b81563fdeee3f93c4b7a316f78e7c0e8e6430a575a5c78ed` | Success |
| Reissue 1 as Token ID 4 | `0x1bbefa6e17bbf09f3d10728610296d840636755311a767fb01e1f0c21a812059` | Success |

## Verified State

- `DEFAULT_ADMIN_ROLE` and `RECOVERY_ROLE` belong to the admin address.
- `MINTER_ROLE` belongs to the separate minter address.
- Token ID 2 owner: `0x0000000000000000000000000000000000000101`
- Token ID 3 owner: `0x0000000000000000000000000000000000000102`
- Token ID 4 owner: admin address
- Token ID 4 is locked and has the reissued metadata URI.
- Token ID 1 no longer exists and `reissueAvailable(1)` is `false` after recovery.
- `nextTokenId()` is `5`.
- Holder-to-holder transfer of Token ID 4 reverts.
- Admin minting, minter burning, and a second reissue from Token ID 1 all revert.

## Local Test Wallet

The Fuji minter key is stored only in the ignored encrypted keystore at `keystores/minter`. The public minter address and
test contract address are recorded in the ignored `.env` file. Neither file should be committed.

## RPC Note

The first automatic `cast send` gas estimate returned a transient `exceeds block gas limit` error before submission.
Retrying with an explicit limit succeeded. A later raw `eth_estimateGas` call returned `130,816` gas against the current
Fuji block limit of `32,000,000`, so this was an RPC/client estimation incident rather than a contract gas-limit issue.
