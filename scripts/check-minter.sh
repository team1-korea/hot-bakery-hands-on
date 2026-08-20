#!/usr/bin/env bash
# 민터가 실제로 민팅할 수 있는 상태인지 확인한다. 권한과 잔액 둘 다 본다.
set -euo pipefail

root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
rpc=${AVALANCHE_RPC_URL:-https://api.avax-test.network/ext/bc/C/rpc}
contract=0x67Ce0bb25ee58B6D000d209B051b9E846D0d6b36
minter_role=0x9f2df0fed2c77648de5860a4cc508cd0818c85b8b8a1ab4ceeef8d981c8956a6

key=$(sed -n 's/^MINTER_PRIVATE_KEY=\(0x[0-9a-fA-F]\{64\}\)$/\1/p' "$root/apps/web/.env.local")
[ -n "$key" ] || { echo "apps/web/.env.local에 MINTER_PRIVATE_KEY가 없습니다."; exit 1; }

addr=$(cast wallet address --private-key "$key")
echo "민터 주소: $addr"

if [ "$(cast call "$contract" "hasRole(bytes32,address)(bool)" "$minter_role" "$addr" --rpc-url "$rpc")" = "true" ]; then
  echo "  권한: 있음"
else
  echo "  권한: 없음 — 관리자 지갑으로 grantRole을 먼저 하세요"
fi

wei=$(cast balance "$addr" --rpc-url "$rpc")
echo "  잔액: $(cast from-wei "$wei") AVAX"
[ "$wei" = "0" ] && echo "  가스를 보내세요. 25 gwei 기준 한 건에 약 0.0033 AVAX입니다."
exit 0
