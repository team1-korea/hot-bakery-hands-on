# Avalanche Bakery — 프론트엔드

## 무엇을 만드는가
쿠키 클래스 오프라인 행사(참가자 15명)에서, 참가자가 자기가 구운 쿠키 사진을 올리면
Avalanche C-Chain에 참가증서 NFT가 발행되고 그 과정이 행사장 TV에 실시간으로 보이는 웹.
지금은 **백엔드 없이 UI/UX 초안만** 만든다. 모든 데이터는 목업.

## 화면
- `/display` — 행사장 TV. 55인치, 3~5m 거리에서 15명이 동시에 본다. 이 프로젝트의 얼굴.
- `/join` — 참가자 폰. 세로 화면 전용. 손에 아이싱 묻은 채로 30초 안에 끝나야 한다.
- `/admin` — 운영 노트북. 예쁠 필요 없고 빠르고 정확하면 된다.

## 아트 디렉션 (고정)
동네 제과점 간판과 쇼케이스에서 출발한다. Web3 대시보드처럼 보이면 실패다.

- 굵은 획의 디스플레이 타이포 + 넓은 자간의 작은 모노 라벨, 두 가지만 쓴다
- 색은 면으로 쓴다. 그라데이션·글로우·글래스모피즘 금지
- 카드에 그림자를 겹겹이 쌓지 않는다. 테두리와 색면으로 층을 만든다
- 이모지 금지. 아이콘은 최소한으로
- 모션은 의미가 있을 때만. 장식용 파티클·플로팅 애니메이션 금지

### 색
```
--ava      #E84142   Avalanche 레드. 이 화면의 주인공 색이다. 아끼지 말고 면으로 써라
--ember    #B32B2C   레드의 어두운 쪽. 오븐 내부, 그림자, 눌린 상태
--paper    #F7F1E8   따뜻한 오프화이트. 작업대와 진열장의 바탕
--ink      #17110F   거의 검정. 텍스트와 오븐 내부
--gold     #D9A441   구운 색. 진열장 조명과 완료 상태에만. 극히 제한적으로
```

원칙:
- 레드를 액센트로 쓰지 마라. 큰 면적으로 써라. 상단 바, 오븐 외장, 완료 배지
- 흰색(#FFF)을 쓰지 마라. 항상 `--paper`
- 회색을 쓰지 마라. 중간톤이 필요하면 `--ink`나 `--paper`의 투명도를 조절해라
- 그라데이션 금지. 단 오븐 내부 발광은 예외 (`--ember` → `--ava` 방사형)
- 이모지 금지. 그림자 겹치기 금지. 글래스모피즘 금지

### 금지 목록
검정 배경 + 네온, 보라 그라데이션, Inter/Geist 기본 조합, 카드 안 카드 안 카드,
"Powered by" 배지, 퍼센트 프로그레스 바, 로딩 스피너 남발.

## 데이터 계약
`lib/types.ts`의 타입이 곧 백엔드와의 계약이다. 마음대로 바꾸지 말 것.
백엔드는 팀원이 별도로 구현하며, 이 형태로 `GET /api/state`를 내려준다.

## 스택
Next.js App Router + TypeScript + Tailwind + Framer Motion. 그 외 라이브러리 추가 전에 물어볼 것.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
