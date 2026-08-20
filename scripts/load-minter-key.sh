#!/usr/bin/env bash
# 민터 개인키를 keystore에서 꺼내 apps/web/.env.local에 넣는다.
#
# 키가 화면에도 셸 히스토리에도 남지 않는다. 비밀번호는 숨김 프롬프트로 받으므로
# **진짜 터미널에서 실행해야 한다** (Terminal.app, iTerm 등). 에디터나 에이전트 안에서
# 돌리면 TTY가 없어 "Device not configured"로 실패한다.
#
#   ./scripts/load-minter-key.sh
set -euo pipefail

root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
env_file="$root/apps/web/.env.local"
expected=0x10dD14002A7EfFAEb52272BC2e04a6113d0ff608

[ -t 0 ] || { echo "진짜 터미널에서 실행하세요. 비밀번호를 숨김 입력으로 받습니다." >&2; exit 1; }
[ -f "$env_file" ] || { echo "$env_file 이 없습니다." >&2; exit 1; }

key=$(cast wallet decrypt-keystore minter --keystore-dir "$root/contracts/keystores" \
      | sed -n 's/.*\(0x[0-9a-fA-F]\{64\}\).*/\1/p')
[ -n "$key" ] || { echo "키를 꺼내지 못했습니다. 비밀번호를 확인하세요." >&2; exit 1; }

# 꺼낸 키가 정말 그 민터인지 확인한다. 다른 지갑을 넣으면 mint가 권한 오류로 리버트한다.
got=$(cast wallet address --private-key "$key")
if [ "$(echo "$got" | tr 'A-Z' 'a-z')" != "$(echo "$expected" | tr 'A-Z' 'a-z')" ]; then
  echo "주소가 다릅니다. 기대 $expected, 실제 $got" >&2
  exit 1
fi

tmp=$(mktemp); trap 'rm -f "$tmp"' EXIT
grep -v '^MINTER_PRIVATE_KEY=' "$env_file" > "$tmp"
printf 'MINTER_PRIVATE_KEY=%s\n' "$key" >> "$tmp"
cat "$tmp" > "$env_file"

echo "완료. $got 의 키를 apps/web/.env.local에 넣었습니다."
