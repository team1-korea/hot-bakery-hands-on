# 민팅 파이프라인

제출부터 진열장 착지까지 백엔드가 하는 일입니다. API 계약은 [API_REFERENCE.md](./API_REFERENCE.md),
컨트랙트 호출 규약은 [contracts/INTEGRATION_GUIDE.md](./contracts/INTEGRATION_GUIDE.md)가 정본입니다.

## 결정 요약

| 항목 | 결정 |
|---|---|
| 민팅 방식 | **건별 즉시 민팅.** `batchMint` 쓰지 않음 |
| 실행 순서 | 한 번에 하나씩 **직렬 처리** |
| 네트워크 | Fuji (`43113`) — `0x67Ce0bb25ee58B6D000d209B051b9E846D0d6b36` |
| 참가자 지갑 | Privy 임베디드 EOA. 프론트에서 구글 로그인 |
| 증서 이미지 합성 | **프론트에서 함.** 정사각형 사진을 1080×1440 세로형 프레임에 합성. 서버는 다시 그리지 않음 |
| 서버가 받는 이미지 | **합성본 한 장.** 원본 사진은 서버로 오지 않음 |
| 카드가 생기는 시점 | **로그인·닉네임 입력 직후.** 사진 제출 전에 작업대에 올라감 |
| IPFS에 올리는 것 | **합성본과 메타데이터.** 그 둘뿐 |
| 메타데이터 | `ipfs://` CID. `external_url` 없음 |
| 실행 환경 | Vercel + Supabase Postgres + Pinata |

### `batchMint`를 쓰지 않는 이유

1. **원자적입니다.** 한 명이라도 잘못되면 전원 발급이 취소됩니다.
2. **연출이 무너집니다.** 배치가 한 번에 끝나면 모두 동시에 `MINTED`가 되어, 오븐이 굽는 곳이 아니라
   개찰구가 됩니다.
3. **처리량이 필요 없습니다.** TV 애니메이션이 병목이라 체인을 빨리 해도 화면이 못 따라옵니다.

---

## 상태와 화면

세 구역은 **누가 손대야 하는가**로 나뉩니다.

| 구역 | 뜻 | 상태 |
|---|---|---|
| **오븐 대기**(작업대) | 사람 손이 필요하다 | `JOINED`, `FAILED` |
| **증서 오븐** | 기계가 처리 중이다 | `SUBMITTED`, `PINNED`, `MINTING` |
| **오늘의 진열장** | 끝났다 | `MINTED` |

```
JOINED ──→ SUBMITTED ──→ PINNED ──→ MINTING ──→ MINTED
   └───────────┴────────────┴──────────┴──────→ FAILED
```

| 상태 | 화면 위치 | 카드가 움직이나 |
|---|---|---|
| `JOINED` | 작업대 | 떨어진다 |
| `SUBMITTED` | 오븐 | **작업대 → 오븐** |
| `PINNED` | 오븐 | **안 움직임** |
| `MINTING` | 오븐 | **안 움직임** |
| `MINTED` | 진열장 | **오븐 → 진열장** |
| `FAILED` | 작업대 | 되돌아온다 |

> TV는 **`SUBMITTED`와 `MINTED` 두 전이에만 반응**합니다. `SUBMITTED`·`PINNED`·`MINTING`은
> 화면상 구별되지 않습니다. 셋 다 오븐 안입니다. 단계를 몇 개로 쪼개든 화면은 달라지지 않으므로,
> 실패 지점을 구분하기 좋게 나눠 두면 됩니다.

작업대에 남는 것은 **전부 운영자가 볼 것**입니다 — 아직 사진을 안 낸 사람과 실패한 사람.

> **예외 하나.** 오븐은 4칸입니다. 다섯 명이 한꺼번에 제출하면 다섯째 카드는 `SUBMITTED`인데도
> 자리가 날 때까지 작업대에서 기다립니다(`displaySequence.ts`가 빈 칸이 있을 때만 이동시킵니다).
> 몇 초짜리 대기이고 화면은 깨지지 않지만, 그 순간만큼은 작업대에 "운영자가 볼 것이 아닌" 카드가
> 섞입니다.

### 굽기 전 카드에는 사진이 없습니다

`JOINED` 카드는 아직 사진이 없습니다. **오류가 아니라 정상 상태입니다.** `CookieCard.tsx`가 기본
쿠키 그림을 항상 먼저 깔고 사진이 있으면 그 위에 덮으므로, `photoUrl`이 null이면 쿠키 그림만
보입니다. 그림은 entry id에서 뽑은 `cookie-variant-1~15` 중 하나라, 대기 카드가 여러 장 깔려도
같은 쿠키가 반복되지 않습니다.

### 화면이 소화할 수 있는 속도

`apps/web/components/display/`에 박힌 값들입니다.

```
MAX_ACTIVE_MOVES = 1      // 카드는 한 번에 하나씩만 움직인다 (전역 직렬)
MIN_OVEN_MS      = 2000   // 오븐에 최소 2초는 있어야 나갈 수 있다
CARD_MOVE_MS     = 720    // 이동 한 번에 0.72초
OVEN_SLOT_COUNT  = 4      // 오븐 4칸
```

카드 하나가 작업대에서 진열장까지 **최소 약 3.4초**입니다. 민팅 한 건이 10~15초 걸리므로
**체인이 아니라 화면이 여유 있는 쪽**입니다. 서두를 이유가 없습니다.

---

## 파이프라인

### 0. 등록 → `JOINED`

참가자가 구글 로그인을 마치고 닉네임을 넣으면 **사진을 찍기 전에** 등록합니다. 여기서 카드가
생기고 작업대에 떨어집니다.

1. Privy 토큰을 검증하고 DID를 얻는다
2. Privy 서버 API로 **임베디드 지갑 주소를 조회한다** (클라이언트가 보낸 주소는 믿지 않는다)
   — 지갑이 없으면 여기서 `400 WALLET_NOT_FOUND`
3. `participants` 행을 찾거나 만든다
4. `entries` 행을 `JOINED`로 만든다. **`shelfIndex`는 아직 배정하지 않는다(null)**

**이 단계가 있는 이유는 사진을 못 올리는 참가자를 구제하기 위해서입니다.** 지갑 주소와 닉네임을
미리 확보해 두면, 업로드가 계속 실패해도 운영자가 사진을 어떤 경로로든 받아 대신 올릴 수 있습니다
(아래 「운영자 대리 업로드」). 제출 시점에 행을 만들면 그 참가자는 서버에 존재조차 하지 않아
손쓸 방법이 없습니다.

> **`GET /api/state`에 지갑 주소와 DID를 넣지 마세요.** 인증 없는 공개 엔드포인트이고, 이 단계
> 때문에 카드 수가 늘어난 만큼 새는 면적도 넓어집니다. 카드에 나가는 것은 닉네임뿐입니다.

### 1. 제출 → `SUBMITTED`

`POST /api/entries`가 받는 즉시 처리합니다. **응답은 바로 내보냅니다.** 여기서 카드가 오븐으로
들어갑니다.

1. Privy 토큰을 검증하고 DID로 `JOINED` 행을 찾는다 (없으면 0단계를 먼저 시킨다)
2. **합성 증서 한 장을** Supabase Storage에 올린다 — 프론트가 합성까지 끝내서 보냅니다
3. 행을 `SUBMITTED`로 올리고 `shelfIndex`를 배정한다
4. **`201`을 응답한다** — 여기까지가 요청 안에서 끝나야 하는 일
5. 뒤이어 파이프라인을 시작한다

```ts
import { after } from 'next/server';

export async function POST(request: Request) {
  const entry = await attachPhoto(...);   // JOINED → SUBMITTED
  after(() => runPipeline(entry.id));     // 응답 후에 이어서 돈다
  return NextResponse.json(entry, { status: 201 });
}
```

**서버는 이미지를 다시 그리지 않습니다.** 리사이즈도 합성도 프론트가 끝냈습니다. 받은 바이트를
그대로 저장하고 그대로 핀합니다 — 재인코딩하면 참가자가 확인 화면에서 본 증서와 체인에 박히는
증서가 달라집니다. `sharp`·`node-canvas`·`satori` 어느 것도 필요 없습니다.

`Entry.photoUrl`에 이 합성본의 URL이 들어갑니다. 별도 원본·증서 URL 필드는 없습니다.

**`shelfIndex`는 등록이 아니라 여기서 배정합니다.** 제출 순서대로 0부터 매기고 **이후 절대
바꾸지 않습니다.** 등록 시점에 배정하면 로그인만 하고 사라진 사람이 진열장 칸을 영구히 점유해
격자에 구멍이 남습니다(`Showcase.tsx`가 `shelfIndex`로 칸을 찾습니다). `shelf_index < 30` 체크
제약이 정원 제한을 겸합니다 — 31번째는 제약 위반으로 튕기고, 그것을 `SHOWCASE_FULL`로 변환합니다.
이탈자는 `shelfIndex`가 없으므로 정원을 갉아먹지 않습니다.

### 2. IPFS 핀 → `PINNED`

**핀을 두 번 합니다.** 합성 증서 먼저, 그 CID로 메타데이터를 만들어 다시 핀.

```
저장된 합성 증서 → Pinata → ipfs://<certificateCid>
                ↓
       메타데이터 JSON 조립
                ↓
        Pinata → ipfs://<metadataCid>
```

**화면은 안 움직입니다.** 카드는 이미 오븐 안에 있습니다.

> **원본 사진은 존재하지 않습니다.** 프론트가 합성해서 보내므로 서버에는 합성본 한 장뿐입니다.
> IPFS에 올라가는 것도 그 합성본입니다.

```jsonc
{
  "name": "Avalanche Bakery 참가 증서 — 쿠키왕",
  "description": "2026년 8월 쿠키 클래스에서 쿠키왕이 구운 쿠키의 참가 증서입니다.",
  "image": "ipfs://bafybe.../certificate.png",
  "attributes": [
    { "trait_type": "닉네임", "value": "쿠키왕" },
    { "trait_type": "행사",   "value": "Avalanche Bakery" },
    { "trait_type": "발행일", "display_type": "date", "value": 1787000000 }
  ]
}
```

- **`external_url`은 넣지 않습니다.** 한 달 뒤 사라질 주소를 체인에 영구히 박지 않기 위해서입니다.
  빈 문자열도 넣지 마세요. 키 자체를 뺍니다.
- **`name`에 `tokenId`를 넣지 않습니다.** `tokenId`는 민팅이 끝나야 알 수 있는데 메타데이터는
  민팅 **전에** 올라가야 합니다. 닉네임을 쓰면 이 순환이 없어집니다.
- `발행일`은 제출 시각이나 행사 당일 날짜를 씁니다. 민팅 시각일 필요가 없습니다.
- 컨트랙트에 **메타데이터 수정 함수가 없습니다.** 한 번 올리면 끝입니다.

`metadataCid`를 DB에 저장하고 `PINNED`로 올립니다. **화면은 아직 안 움직입니다.**

### 3. 민팅 → `MINTING`

카드는 이미 오븐 안에 있습니다. **화면은 안 움직입니다.**

```
hasBeenIssued(recipient) == false 확인
      ↓
status = 'MINTING'
      ↓
simulateContract(mint, [recipient, `ipfs://${metadataCid}`])
      ↓
writeContract → txHash 저장
```

- 호출자는 `MINTER_ROLE`을 가진 서버 지갑입니다.
- `recipient`는 **Privy가 만든 참가자 지갑 주소**입니다.
- `metadataURI`는 빈 문자열이면 안 됩니다.
- 컨트랙트가 **주소당 한 장**을 강제합니다. 소각해도 `hasBeenIssued`는 `true`로 남습니다.

### 4. 영수증 → `MINTED`

```
waitForTransactionReceipt(txHash)
      ↓
receipt.status === 'success' 확인
      ↓
CertificateIssued 이벤트에서 tokenId 읽기
      ↓
status = 'MINTED', tokenId 저장   ← 카드가 진열장으로 이동
```

- **전송만으로 `MINTED`를 쓰지 마세요.** 실패한 발행이 진열장에 놓입니다.
- **`tokenId`는 이벤트에서 읽습니다.** 컨트랙트에 주소→토큰 역조회가 없습니다
  (`totalSupply`, `tokensOfOwner` 모두 없음).
- **`tokenId`는 문자열로 저장합니다.** `uint256`을 JSON에 넣기 전에 `toString()`.

---

## 직렬화

민터 지갑이 하나라 **동시에 트랜잭션을 보내면 nonce가 충돌**합니다. 서버리스는 인보케이션이 여러 개
동시에 뜨므로 DB로 막습니다.

```sql
-- 한 번에 하나만 집어간다. 다른 인보케이션은 그냥 건너뛴다
select * from entries
where status = 'PINNED'
order by shelf_index
for update skip locked
limit 1;
```

또는 advisory lock 한 줄:

```sql
select pg_try_advisory_lock(42);   -- 못 잡으면 이번 인보케이션은 아무것도 안 하고 종료
```

락을 못 잡은 인보케이션은 **그냥 끝내면 됩니다.** 남은 일은 다음 제출이나 스위퍼가 주워갑니다.

---

## 실패와 재시도

### 실패 기록

어느 단계든 실패하면 `FAILED`로 내리고 `failureReason`을 채웁니다.

- `failureReason`은 **운영자용**입니다. 참가자에게 그대로 보여주지 않습니다.
- **`GET /api/state`에 `failureReason`을 넣지 마세요.** 인증 없는 공개 엔드포인트입니다.

운영자가 `PATCH /api/admin/entries/{id}` `{"retry": true}`로 다시 시도합니다. 실패한 카드는
작업대로 돌아옵니다 — 사람이 손봐야 하는 것들이 모이는 곳입니다.

### 운영자 대리 업로드

**사진을 못 올리는 참가자를 구제하는 경로입니다.** 0단계에서 지갑 주소와 닉네임을 미리 받아두는
이유가 이것입니다.

참가자의 업로드가 계속 실패하면(폰이 이상하거나, 행사장 와이파이가 죽거나, 브라우저가 사진
형식을 못 읽거나), 운영자가 사진을 **어떤 경로로든** 받아 운영자 화면에서 대신 올립니다. 그러면
`JOINED` 행이 `SUBMITTED`로 올라가고 파이프라인이 정상으로 돕니다.

> **합성은 운영자 화면에서도 해야 합니다.** 프레임 합성이 브라우저에 있고 서버는 다시 그리지
> 않으므로, 운영자가 원본 사진을 올리면 그 화면에서 같은 합성을 거쳐야 합니다. 운영자 화면도
> 브라우저이므로 `lib/photo.ts`를 그대로 재사용하면 됩니다. **합성 함수를 참가자 화면 전용으로
> 만들지 마세요.**

> ⚠️ 이 기능이 있으면 **운영자는 아무 참가자에게 아무 사진이나 붙일 수 있습니다.** 운영자
> 비밀번호에 시도 횟수 제한이 없고 행사장에서 HTTP LAN 주소로 열립니다. 비밀번호를 길게 잡으세요.

### 스위퍼

`GET|POST /api/internal/sweep`가 두 가지를 훑습니다. `Authorization: Bearer <CRON_SECRET>`으로
잠겨 있으며, 운영에서는 Supabase Cron이 1분마다 호출합니다. 설치 SQL은
`apps/web/db/cron.sql`에 있습니다.

**① 중간 상태로 멈춘 행 → `FAILED`.** `after()`는 재시도를 해주지 않습니다. 인보케이션이 죽으면
행이 `SUBMITTED`나 `PINNED`로 남습니다. **N분 이상 중간 상태인 행을 `FAILED`로 내립니다.** 안
그러면 영원히 오븐에 남아 있는 카드가 생깁니다.

**② 오래 방치된 `JOINED` 행 → `hidden`.** 로그인만 하고 사라진 사람의 카드가 행사 내내 작업대에
남습니다. **N분(10분 정도) 넘게 `JOINED`인 행을 자동으로 `hidden` 처리합니다.** 이걸 안 붙이면
작업대가 유령 카드로 찹니다.

> `hidden`은 되돌릴 수 있어야 합니다. 자동으로 내려간 참가자가 늦게 사진을 내면 제출
> 트랜잭션이 다시 보여 줍니다. 운영자가 직접 숨긴 카드는 자동 복원하지 않습니다.

### ⚠️ 이미 발행된 건의 복구

트랜잭션은 성공했는데 DB 갱신 전에 함수가 죽는 경우가 있습니다. 재시도하면 `mint`가
`AlreadyIssued(recipient)`로 리버트합니다. **여기서 `FAILED` 처리하면 이미 발행된 증서를 잃어버립니다.**

`CertificateIssued(uint256 indexed tokenId, address indexed recipient, string tokenURI)`에서
`recipient`가 indexed이므로 주소로 찾을 수 있습니다.

```ts
// AlreadyIssued로 리버트 = 실패가 아니라 이미 성공한 것
const logs = await client.getLogs({
  address: CERTIFICATE_ADDRESS,
  event: certificateIssuedEvent,
  args: { recipient },
  fromBlock: 57821222n,        // deployments/43113.json의 deploymentBlock
});
// 여기서 tokenId를 건져 MINTED로 마무리한다
```

---

## 실행 모델 (Vercel)

파이프라인 한 건이 **10~15초**입니다. 요청 응답 안에서 처리하면 함수 타임아웃에 걸립니다.

- `after()`로 응답 후에 이어서 돕니다. 제출·운영자 대리 업로드·재시도 라우트에
  `maxDuration = 60`이 설정돼 있습니다. Vercel 플랜의 실제 상한은 배포 리허설에서 확인합니다.
- **DB가 진실의 원천입니다.** 각 단계가 끝나는 즉시 행을 갱신하세요. 그래야 죽어도 어디까지 갔는지 압니다.
- 목 구현의 `setTimeout` 방식은 서버리스에서 **동작하지 않습니다.** 응답 후 함수가 얼어붙습니다.

---

## 체크리스트

코드 구현 여부와 행사 운영 준비를 구분합니다.

- [x] Privy 토큰을 검증하고 **서버에서** 지갑 주소를 조회한다 (클라이언트 값 신뢰 금지)
- [x] 로그인·닉네임 시점에 `JOINED` 행을 만든다. `shelfIndex`는 **비워 둔다**
- [x] `shelfIndex`를 **사진 제출 시점에** 배정한다
- [x] 제출·대리 업로드·재시도가 즉시 응답하고 파이프라인은 `after()`로 돈다
- [x] 받은 합성본을 **재인코딩하지 않고 그대로** 저장하고 핀한다
- [x] **합성본과 메타데이터를** 각각 핀한다
- [x] 메타데이터에 `external_url`과 `tokenId`를 넣지 않는다
- [x] `mint` 전에 `hasBeenIssued(recipient) == false`를 확인한다
- [x] 민팅을 Postgres advisory lock으로 직렬화한다
- [x] 영수증 성공과 `CertificateIssued` 확인 뒤에만 `MINTED`로 올린다
- [x] `tokenId`를 문자열로 저장하고 내려준다
- [x] `AlreadyIssued`와 멈춘 `MINTING`을 이벤트 조회로 복구한다
- [x] 공개 state에서 `failureReason`·지갑 주소·DID를 제외한다
- [x] 중간 상태 실패 처리와 오래된 `JOINED` 자동 내림 로직·내부 라우트가 있다
- [x] 운영자 대리 사진 업로드 API와 화면이 있다
- [x] 참가자·운영자 대리 업로드가 외부 최종 프레임과 같은 합성 함수를 함께 쓴다
- [ ] Vercel에서 `after()`를 검증하고 Supabase에 `/api/internal/sweep` 1분 Cron을 설정한다
- [ ] 실제 Privy Google 로그인부터 민팅까지 한 명 end-to-end 리허설을 한다
- [ ] 행사 직전 Supabase·민터 잔액·빈 DB/Storage를 확인한다
