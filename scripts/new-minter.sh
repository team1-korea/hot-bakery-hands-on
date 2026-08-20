#!/usr/bin/env bash
# 새 민터 지갑을 만들어 apps/web/.env.local에 넣고, 권한 부여에 필요한 값을 알려준다.
#
# 이전 민터(0x10dD1400…)는 keystore 비밀번호가 어디에도 기록되지 않아 열 수 없다.
# 관리자 권한은 메타마스크에 있으므로 민터는 언제든 갈아치울 수 있고, 이미 발행된
# 증서에는 아무 영향이 없다.
#
#   ./scripts/new-minter.sh
set -euo pipefail

root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
env_file="$root/apps/web/.env.local"
contract=0x67Ce0bb25ee58B6D000d209B051b9E846D0d6b36
minter_role=0x9f2df0fed2c77648de5860a4cc508cd0818c85b8b8a1ab4ceeef8d981c8956a6

[ -f "$env_file" ] || { echo "$env_file 이 없습니다." >&2; exit 1; }

if grep -q '^MINTER_PRIVATE_KEY=0x' "$env_file"; then
  echo "이미 MINTER_PRIVATE_KEY가 채워져 있습니다." >&2
  echo "덮어쓰려면 .env.local에서 그 줄을 비우고 다시 실행하세요." >&2
  exit 1
fi

out=$(cast wallet new --json)
key=$(echo "$out" | sed -n 's/.*"private_key": *"\([^"]*\)".*/\1/p')
addr=$(echo "$out" | sed -n 's/.*"address": *"\([^"]*\)".*/\1/p')
[ -n "$key" ] && [ -n "$addr" ] || { echo "지갑 생성 실패" >&2; exit 1; }

tmp=$(mktemp); trap 'rm -f "$tmp"' EXIT
grep -v '^MINTER_PRIVATE_KEY=' "$env_file" > "$tmp"
printf 'MINTER_PRIVATE_KEY=%s\n' "$key" >> "$tmp"
cat "$tmp" > "$env_file"

# grantRole(bytes32,address) — 메타마스크의 16진 데이터 칸에 그대로 넣는다.
calldata=$(cast calldata "grantRole(bytes32,address)" "$minter_role" "$addr")

cat <<EOF

새 민터 주소: $addr
개인키는 apps/web/.env.local에 넣었습니다. 화면에 찍지 않았습니다.

────────────────────────────────────────────────────────────
메타마스크에서 두 가지를 하세요. Fuji 네트워크, 관리자 지갑
(0x7a227D5902cA52C0C3C61304533bfF4632Fce145)으로 하셔야 합니다.

1) 민팅 권한 주기
   받는 주소 : $contract
   금액      : 0
   16진 데이터:
$calldata

2) 가스 보내기
   받는 주소 : $addr
   금액      : 0.2 AVAX

끝나면 ./scripts/check-minter.sh 로 확인하세요.
────────────────────────────────────────────────────────────
EOF
