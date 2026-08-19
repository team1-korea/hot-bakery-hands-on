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
| 증서 이미지 합성 | **함.** 쿠키 사진에 프레임을 둘러 합성. 프레임은 디자인 제작 |
| IPFS에 올리는 것 | **합성본.** 원본 사진은 우리 저장소에만 두고 종료 시 파기 |
| 메타데이터 | `ipfs://` CID. `external_url` 없음 |
| 실행 환경 | Vercel + Supabase Postgres + Pinata |

### `batchMint`를 쓰지 않는 이유

1. **원자적입니다.** 한 명이라도 잘못되면 전원 발급이 취소됩니다.
2. **연출이 무너집니다.** 배치가 한 번에 끝나면 모두 동시에 `MINTED`가 되어, 오븐이 굽는 곳이 아니라
   개찰구가 됩니다.
3. **처리량이 필요 없습니다.** TV 애니메이션이 병목이라 체인을 빨리 해도 화면이 못 따라옵니다.

---

## 상태와 화면

TV는 **`MINTING`과 `MINTED` 두 전이에만 반응**합니다. 그 앞 단계들은 화면상 구별되지 않습니다.

```
SUBMITTED ──→ RENDERED ──→ PINNED ──→ MINTING ──→ MINTED
    └────────────┴────────────┴──────────┴──────→ FAILED
```

| 상태 | 화면 위치 | 카드가 움직이나 |
|---|---|---|
| `SUBMITTED` | 작업대 | 떨어진다 |
| `RENDERED` | 작업대 | **안 움직임** |
| `PINNED` | 작업대 | **안 움직임** |
| `MINTING` | 오븐 | **작업대 → 오븐** |
| `MINTED` | 진열장 | **오븐 → 진열장** |
| `FAILED` | 작업대 | 되돌아온다 |

> `SUBMITTED`·`RENDERED`·`PINNED`는 TV에서 구별되지 않습니다. 셋 다 작업대에 놓인 대기 카드입니다.
> 단계를 몇 개로 쪼개든 화면은 달라지지 않으므로, 실패 지점을 구분하기 좋게 나눠 두면 됩니다.

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

### 1. 제출 → `SUBMITTED`

`POST /api/entries`가 받는 즉시 처리합니다. **응답은 바로 내보냅니다.**

1. Privy 토큰을 검증하고 DID를 얻는다
2. Privy 서버 API로 **임베디드 지갑 주소를 조회한다** (클라이언트가 보낸 주소는 믿지 않는다)
3. `participants` 행을 찾거나 만든다
4. 사진을 Supabase Storage에 올린다
5. `entries` 행을 `SUBMITTED`로 만들고 `shelfIndex`를 배정한다
6. **`201`을 응답한다** — 여기까지가 요청 안에서 끝나야 하는 일
7. 뒤이어 파이프라인을 시작한다

```ts
import { after } from 'next/server';

export async function POST(request: Request) {
  const entry = await createEntry(...);   // SUBMITTED
  after(() => runPipeline(entry.id));     // 응답 후에 이어서 돈다
  return NextResponse.json(entry, { status: 201 });
}
```

`shelfIndex`는 제출 순서대로 0부터 배정하고 **이후 절대 바꾸지 않습니다.** `shelf_index < 30` 체크
제약이 정원 제한을 겸합니다 — 31번째는 제약 위반으로 튕기고, 그것을 `SHOWCASE_FULL`로 변환합니다.

### 2. 증서 합성 → `RENDERED`

쿠키 사진에 **프레임을 둘러 증서 이미지를 만듭니다.** 프레임 에셋과 합성 규격은 디자인에서 받습니다.

합성본을 Supabase Storage에 올리고 `certificateUrl`을 채웁니다. TV는 `MINTED` 이후 이 이미지를
보여줍니다(`CookieCard.tsx`: `minted ? certificateUrl ?? photoUrl : photoUrl`).

**화면은 아직 안 움직입니다.** 카드는 작업대에 그대로 있습니다.

> 합성 라이브러리(`sharp` / `node-canvas` / `satori`)와 캔버스 규격은 프레임 에셋을 받은 뒤에
> 정합니다.

### 3. IPFS 핀 → `PINNED`

**핀을 두 번 합니다.** 합성 증서 먼저, 그 CID로 메타데이터를 만들어 다시 핀.

```
합성 증서 이미지 → Pinata → ipfs://<certificateCid>
                ↓
       메타데이터 JSON 조립
                ↓
        Pinata → ipfs://<metadataCid>
```

> **원본 사진은 IPFS에 올리지 않습니다.** 우리 저장소에만 두고 굽기 전 TV 카드에만 씁니다.
> 그래서 서비스 종료 때 원본을 파기할 수 있습니다.

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

### 4. 민팅 → `MINTING`

여기서 카드가 오븐으로 들어갑니다. **상태를 먼저 올리고 트랜잭션을 보냅니다.**

```
hasBeenIssued(recipient) == false 확인
      ↓
status = 'MINTING'      ← 카드가 오븐으로 이동
      ↓
simulateContract(mint, [recipient, `ipfs://${metadataCid}`])
      ↓
writeContract → txHash 저장
```

- 호출자는 `MINTER_ROLE`을 가진 서버 지갑입니다.
- `recipient`는 **Privy가 만든 참가자 지갑 주소**입니다.
- `metadataURI`는 빈 문자열이면 안 됩니다.
- 컨트랙트가 **주소당 한 장**을 강제합니다. 소각해도 `hasBeenIssued`는 `true`로 남습니다.

### 5. 영수증 → `MINTED`

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

운영자가 `PATCH /api/admin/entries/{id}` `{"retry": true}`로 다시 시도합니다.

### 스위퍼

`after()`는 재시도를 해주지 않습니다. 인보케이션이 죽으면 행이 중간 상태로 남습니다.
`pg_cron`으로 1분마다 훑어서 **N분 이상 중간 상태인 행을 `FAILED`로 내립니다.** 안 그러면 영원히
오븐에 남아 있는 카드가 생깁니다.

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

- `after()`로 응답 후에 이어서 돌립니다. 라우트에 `export const maxDuration = 60`을 주세요.
  (플랜별 상한은 확인이 필요합니다.)
- **DB가 진실의 원천입니다.** 각 단계가 끝나는 즉시 행을 갱신하세요. 그래야 죽어도 어디까지 갔는지 압니다.
- 목 구현의 `setTimeout` 방식은 서버리스에서 **동작하지 않습니다.** 응답 후 함수가 얼어붙습니다.

---

## 체크리스트

- [ ] Privy 토큰을 검증하고 **서버에서** 지갑 주소를 조회한다 (클라이언트 값 신뢰 금지)
- [ ] `POST /api/entries`가 즉시 응답하고 파이프라인은 `after()`로 돈다
- [ ] 프레임 에셋과 합성 규격을 디자인에서 받는다
- [ ] 합성 증서를 만들어 `certificateUrl`을 채운다
- [ ] **합성본과 메타데이터를** 각각 핀한다. 원본 사진은 IPFS에 올리지 않는다
- [ ] 메타데이터에 `external_url`과 `tokenId`를 넣지 않는다
- [ ] `mint` 전에 `hasBeenIssued(recipient) == false` 확인
- [ ] 민팅을 DB 락으로 직렬화한다
- [ ] 영수증 성공과 `CertificateIssued` 확인 뒤에만 `MINTED`로 올린다
- [ ] `tokenId`를 문자열로 저장하고 내려준다
- [ ] `AlreadyIssued` 리버트를 이벤트 조회로 복구한다
- [ ] `GET /api/state`에 `failureReason`·지갑 주소·DID가 섞이지 않는다
- [ ] 중간 상태로 멈춘 행을 스위퍼가 `FAILED`로 내린다
- [ ] 민터 지갑에 Fuji AVAX를 넉넉히 채운다
- [ ] Supabase 프로젝트를 행사 전에 깨워 둔다 (7일 미사용 시 일시정지)
