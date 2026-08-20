#!/usr/bin/env bash
# .env.local의 민터 주소에 MINTER_ROLE을 준다. contracts/.env의 관리자 키로 보낸다.
#
# 이 저장소의 에이전트는 개인키를 읽지 못하게 막혀 있어서, 이 한 번은 사람이 실행한다.
# 보내기 전에 무엇을 하는지 보여 주고 확인을 받는다.
#
#   ./scripts/grant-minter.sh
set -euo pipefail

root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
rpc=${AVALANCHE_RPC_URL:-https://api.avax-test.network/ext/bc/C/rpc}
contract=0x67Ce0bb25ee58B6D000d209B051b9E846D0d6b36
minter_role=0x9f2df0fed2c77648de5860a4cc508cd0818c85b8b8a1ab4ceeef8d981c8956a6
admin_role=0x0000000000000000000000000000000000000000000000000000000000000000

set -a; . "$root/contracts/.env"; set +a
[ -n "${PRIVATE_KEY:-}" ] || { echo "contracts/.env에 PRIVATE_KEY가 없습니다." >&2; exit 1; }

minter_key=$(sed -n 's/^MINTER_PRIVATE_KEY=\(0x[0-9a-fA-F]\{64\}\)$/\1/p' "$root/apps/web/.env.local")
[ -n "$minter_key" ] || { echo "apps/web/.env.local에 MINTER_PRIVATE_KEY가 없습니다." >&2; exit 1; }

minter=$(cast wallet address --private-key "$minter_key")
admin=$(cast wallet address --private-key "$PRIVATE_KEY")

# 관리자 권한이 없는 키로 보내면 리버트한다. 가스만 태우기 전에 미리 막는다.
if [ "$(cast call "$contract" "hasRole(bytes32,address)(bool)" "$admin_role" "$admin" --rpc-url "$rpc")" != "true" ]; then
  echo "contracts/.env의 PRIVATE_KEY는 관리자가 아닙니다 ($admin)." >&2
  exit 1
fi

if [ "$(cast call "$contract" "hasRole(bytes32,address)(bool)" "$minter_role" "$minter" --rpc-url "$rpc")" = "true" ]; then
  echo "$minter 는 이미 MINTER_ROLE을 갖고 있습니다. 할 일이 없습니다."
  exit 0
fi

cat <<EOF

  보내는 사람 : $admin  (관리자)
  컨트랙트    : $contract
  주는 권한   : MINTER_ROLE
  받는 주소   : $minter

EOF
# TTY가 없는 곳에서도 실행되므로(에디터, 에이전트) 대화형 프롬프트를 쓰지 않는다.
# 위 내용을 보고 다시 --yes로 부르는 것이 확인 절차다.
if [ "${1:-}" != "--yes" ]; then
  echo "위 내용이 맞으면 다시 실행하세요:  ./scripts/grant-minter.sh --yes"
  exit 0
fi

# 가스 한도를 명시한다. Fuji 공개 RPC의 자동 추정이 이따금 'exceeds block gas limit'을
# 돌려주는데, 컨트랙트 문제가 아니라 RPC 추정 버그다(contracts/FUJI_SMOKE_TEST.md에 기록).
# grantRole은 5만 가스면 끝나므로 10만이면 넉넉하다.
cast send "$contract" "grantRole(bytes32,address)" "$minter_role" "$minter" \
  --private-key "$PRIVATE_KEY" --rpc-url "$rpc" --gas-limit 100000 \
  | grep -Ei 'transactionHash|status'

echo
"$root/scripts/check-minter.sh"
