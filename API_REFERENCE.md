# API 레퍼런스

Avalanche Bakery 백엔드가 제공하는 엔드포인트 목록입니다.

- **Base URL**: 프론트와 같은 오리진. 분리하면 `NEXT_PUBLIC_API_BASE_URL`로 지정합니다.
- **타입 정본**: `apps/web/lib/api/types.ts`. 이 문서와 다르면 타입이 맞습니다.
- **배경 설명**은 [API.md](./API.md), 컨트랙트 호출은 [contracts/INTEGRATION_GUIDE.md](./contracts/INTEGRATION_GUIDE.md).

---

## 인증 방식

세 종류가 있습니다. 엔드포인트마다 표에 표시했습니다.

| 표기 | 방식 |
|---|---|
| **참가자** | `Authorization: Bearer <Privy 액세스 토큰>` |
| **운영자** | `bakery_operator` 쿠키 (httpOnly) |
| **없음** | 누구나 호출 가능 |

### 참가자 인증

로그인은 **프론트에서 Privy가 처리**합니다(구글 로그인). 백엔드에는 로그인 엔드포인트가 없습니다.

1. 프론트엔드가 Privy Google 로그인을 실행한다
2. Privy가 참가자에게 embedded EVM 지갑을 만들고 Google 계정과 연결한다
3. 프론트엔드가 Privy access token을 참가자 API 요청에 붙인다
4. 백엔드가 Privy 서버 SDK로 토큰의 **서명·만료·앱 ID**를 검증하고 Privy DID를 얻는다
5. 백엔드가 검증된 사용자의 linked accounts에서 **embedded EVM 지갑 주소를 확인한다**
   (identity token을 함께 쓰거나 Privy Users API를 조회)
6. 최초 제출 때 `privyUserId`(DID)와 `walletAddress`를 저장하고, 이후 조회는 검증된 DID로 찾는다

```http
Authorization: Bearer <privy-access-token>
```

> ⚠️ **지갑 주소를 클라이언트에서 받아 그대로 믿지 마세요.** 임의의 주소로 민팅시킬 수 있습니다.
> 프론트가 주소를 함께 보내더라도 Privy에서 확인한 linked wallet과 일치하는지 검증해야 합니다.
>
> **identity token을 서명 검증 없이 디코딩해 주소를 꺼내지 마세요.**
> access token과 identity token을 함께 쓰면 두 토큰의 DID가 같은지 확인합니다.

구현 기준 문서: [access token](https://docs.privy.io/authentication/user-authentication/access-tokens) ·
[identity token](https://docs.privy.io/user-management/users/identity-tokens)

**오류**

| 상황 | 응답 |
|---|---|
| 토큰 없음·잘못됨·만료 | `401 UNAUTHENTICATED` |
| embedded EVM 지갑을 못 찾음 | `400 WALLET_NOT_FOUND` |

401은 화면이 Privy 로그인을 다시 요청하는 **정상 흐름**입니다. 에러 로그로 취급하지 마세요.

---

## 엔드포인트 목록

| 메서드 | 경로 | 인증 | 용도 |
|---|---|---|---|
| `GET` | `/api/entries` | 참가자 | 내 제출 조회 |
| `POST` | `/api/entries` | 참가자 | 사진·닉네임 제출 |
| `GET` | `/api/state` | 없음 | TV·운영자 화면 폴링 |
| `GET` | `/api/photos/{entryId}` | 없음 | 사진 바이트 |
| `POST` | `/api/admin/session` | 없음 | 운영자 로그인 |
| `GET` | `/api/admin/session` | 운영자 | 로그인 상태 확인 |
| `DELETE` | `/api/admin/session` | 운영자 | 운영자 로그아웃 |
| `PATCH` | `/api/admin/entries/{id}` | 운영자 | 카드 내리기·재시도 |
| `PATCH` | `/api/admin/show` | 운영자 | 앞 화면 전환 |

---

## 참가자

### `GET /api/entries`

내 제출 하나를 돌려줍니다. 아직 제출하지 않았으면 **`200`에 `null`**입니다 (404가 아닙니다).

제출 후 참가자 폰이 **3초마다** 이 경로를 폴링해 발행 완료를 기다립니다.

```http
GET /api/entries
Authorization: Bearer eyJhbGci...
```

```jsonc
// 200 — 제출한 경우
{
  "id": "859e2b03-f1a0-42a0-9f1e-8f596d8e89b9",
  "nickname": "쿠키왕",
  "status": "MINTED",
  "photoUrl": "/api/photos/859e2b03-f1a0-42a0-9f1e-8f596d8e89b9",
  "certificateUrl": null,
  "tokenId": "1001",
  "txHash": "0x4f3c8a...",
  "shelfIndex": 0,
  "hidden": false,
  "failureReason": null,
  "submittedAt": "2026-08-19T05:12:00.000Z"
}
```

```jsonc
// 200 — 아직 제출 안 함
null
```

---

### `POST /api/entries`

사진과 닉네임을 제출합니다. **한 사람당 한 장**입니다.

`Content-Type: multipart/form-data`

| 필드 | 형식 | 검증 |
|---|---|---|
| `photo` | 파일 | 4MB 이하, `image/jpeg` `image/png` `image/webp` |
| `nickname` | 문자열 | 1~12자, 앞뒤 공백 제거 |

프론트가 이미 긴 변 1280px JPEG로 재인코딩해서 보냅니다. 실제로 오는 것은 `image/jpeg` 200KB 안팎이며 HEIC는 올라오지 않습니다.

```http
POST /api/entries
Authorization: Bearer eyJhbGci...
Content-Type: multipart/form-data

photo=<binary>&nickname=쿠키왕
```

```jsonc
// 201
{
  "id": "859e2b03-f1a0-42a0-9f1e-8f596d8e89b9",
  "nickname": "쿠키왕",
  "status": "SUBMITTED",
  "photoUrl": "/api/photos/859e2b03-f1a0-42a0-9f1e-8f596d8e89b9",
  "certificateUrl": null,
  "tokenId": null,
  "txHash": null,
  "shelfIndex": 0,
  "hidden": false,
  "failureReason": null,
  "submittedAt": "2026-08-19T05:12:00.000Z"
}
```

**오류**

| 상황 | 응답 |
|---|---|
| 같은 Privy DID 또는 같은 지갑 주소로 이미 제출함 | `409 ALREADY_SUBMITTED` |
| 정원(30) 초과 | `409 SHOWCASE_FULL` |
| 사진 형식·크기 문제 | `400 INVALID_PHOTO` |
| 닉네임 길이 문제 | `400 INVALID_NICKNAME` |

`shelfIndex`는 제출 순서대로 0부터 배정하고 **이후 절대 바꾸지 않습니다.**

---

## 공개

### `GET /api/state`

행사장 TV와 운영자 화면이 **1초마다** 부릅니다. 캐시하지 마세요.

```http
GET /api/state
```

```jsonc
// 200
{
  "entries": [ /* Entry 배열, shelfIndex 오름차순 */ ],
  "show": { "layout": "LIVE", "qrVisible": true, "shelfPage": 0 },
  "counts": { "submitted": 12, "minted": 9 }
}
```

> ⚠️ **인증 없이 TV에서 열리는 응답입니다.** 다음을 넣지 마세요:
> - 이메일, Privy DID, 지갑 주소
> - `failureReason` — 운영자 전용입니다

`show`는 운영자가 바꾸는 화면 상태입니다. 서버가 들고 있어야 TV와 운영자 화면이 같은 것을 봅니다. `shelfPage`는 저절로 넘어가지 않고 사람이 넘깁니다.

---

### `GET /api/photos/{entryId}`

이미지 바이트를 그대로 돌려줍니다. `Entry.photoUrl`이 이 경로를 가리킵니다.

```http
GET /api/photos/859e2b03-f1a0-42a0-9f1e-8f596d8e89b9
```

```http
200 OK
Content-Type: image/jpeg

<binary>
```

`photoUrl`을 다른 호스트의 절대 URL로 내려줘도 됩니다(예: Supabase Storage 공개 URL). 참가자·운영자 화면은 값을 그대로 `<img src>`에 쓰고, TV는 `next/image`를 `unoptimized`로 씁니다.

없는 항목이면 `404 NOT_FOUND`입니다.

---

## 운영자

비밀번호는 서버 환경변수 `OPERATOR_PASSCODE`입니다. **비어 있으면 아무도 통과하지 못합니다** — 설정을 잊었을 때 열리는 쪽이 아니라 잠기는 쪽으로 실패합니다.

쿠키에는 비밀번호가 아니라 `sha256('bakery-operator:' + passcode)`를 담습니다.

### `POST /api/admin/session` — 로그인

```jsonc
// 요청
{ "passcode": "..." }
```

```http
200 OK
set-cookie: bakery_operator=60b3761b...; Path=/; Max-Age=43200; HttpOnly; SameSite=Lax
```

```jsonc
{ "ok": true }
```

비밀번호가 틀리면 `401 UNAUTHENTICATED`, 서버에 값이 없으면 `500 INTERNAL`입니다.

### `GET /api/admin/session` — 상태 확인

```jsonc
// 200
{ "ok": true }
// 쿠키 없거나 만료 → 401 UNAUTHENTICATED
```

### `DELETE /api/admin/session` — 로그아웃

노트북을 남에게 넘길 때 씁니다. 쿠키를 지웁니다.

```jsonc
// 200
{ "ok": true }
```

---

### `PATCH /api/admin/entries/{id}`

```jsonc
{ "hidden": true }   // 앞 화면에서 내리거나 다시 올린다
{ "retry": true }    // FAILED인 항목을 다시 시도한다
```

응답은 갱신된 `Entry`입니다. `retry`는 `status`가 `FAILED`일 때만 받습니다. 없는 항목이면 `404 NOT_FOUND`입니다.

---

### `PATCH /api/admin/show`

```jsonc
{ "layout": "GALLERY" }   // 'LIVE' | 'GALLERY'
{ "qrVisible": false }
{ "shelfPage": 1 }
```

```jsonc
// 200 — 갱신된 ShowState
{ "layout": "GALLERY", "qrVisible": false, "shelfPage": 1 }
```

---

## 타입

### `Entry`

```ts
type Entry = {
  id: string;
  nickname: string;
  status: EntryStatus;
  photoUrl: string | null;         // 참가자가 올린 원본 쿠키 사진
  certificateUrl: string | null;   // 프레임을 두른 합성 증서. RENDERED 이후 채워진다
  tokenId: string | null;          // uint256이므로 문자열
  txHash: string | null;
  shelfIndex: number | null;       // 진열장 슬롯(0-based). 배정 후 불변
  hidden: boolean;                 // 운영자가 TV에서 내린 카드
  failureReason: string | null;    // FAILED일 때만. 참가자에게 보여주지 않음
  submittedAt: string;             // ISO 8601
};
```

### `EntryStatus`

```
SUBMITTED → RENDERED → PINNED → MINTING → MINTED
     └──────────┴─────────┴─────────┴──→ FAILED
```

| 상태 | 뜻 | 화면 |
|---|---|---|
| `SUBMITTED` | 사진과 닉네임을 받음 | TV 작업대에 카드가 떨어진다 |
| `RENDERED` | 증서 이미지 합성 완료. `certificateUrl`이 채워짐 | 작업대에 머문다 |
| `PINNED` | 메타데이터 IPFS 업로드 완료 | 작업대에 머문다 |
| `MINTING` | 민팅 트랜잭션 전송, 영수증 대기 | 카드가 오븐으로 들어간다 |
| `MINTED` | 영수증 성공 + `CertificateIssued` 확인 | 카드가 진열장에 놓인다 |
| `FAILED` | 어느 단계든 실패 | 참가자에게 안내, 운영자에게 재시도 버튼 |

### `ShowState`

```ts
type ShowState = {
  layout: 'LIVE' | 'GALLERY';   // LIVE는 작업대+오븐, GALLERY는 진열장만 크게
  qrVisible: boolean;
  shelfPage: number;            // 지금 TV에 보이는 진열장 쪽(0부터)
};
```

### 상수

```ts
SHELF_SLOTS = 15   // 진열장 한 쪽의 칸 수 (5×3 격자)
MAX_ENTRIES = 30   // 정원. 진열장 두 쪽
```

---

## 오류 형식

```jsonc
{ "error": { "code": "INVALID_NICKNAME", "message": "닉네임은 1~12자로 적어 주세요." } }
```

`message`는 **참가자에게 그대로 보여줍니다.** 화면은 이 문장을 다시 쓰지 않습니다. 한국어 완성 문장으로 주세요.

| code | 상태 | 뜻 |
|---|---:|---|
| `UNAUTHENTICATED` | 401 | 참가자 토큰 또는 운영자 세션 없음·만료 |
| `WALLET_NOT_FOUND` | 400 | Privy 사용자에게 embedded EVM 지갑이 없음 |
| `ALREADY_SUBMITTED` | 409 | 이미 제출함 |
| `INVALID_PHOTO` | 400 | 사진 형식·크기 문제 |
| `INVALID_NICKNAME` | 400 | 닉네임 길이 문제 |
| `SHOWCASE_FULL` | 409 | 정원 초과 |
| `NOT_FOUND` | 404 | 없는 항목 |
| `INTERNAL` | 500 | 그 외 |

> **`types.ts`의 `ApiErrorCode`가 아직 이 표와 다릅니다.** Privy 연동과 함께 맞춰야 합니다.
> `WALLET_NOT_FOUND`를 추가하고, 쓰이지 않는 `INVALID_EMAIL`·`INVALID_CODE`를 지웁니다.

---

## 환경변수

```dotenv
# 브라우저에 노출되는 값
NEXT_PUBLIC_PRIVY_APP_ID=
NEXT_PUBLIC_API_BASE_URL=      # 비우면 같은 오리진
NEXT_PUBLIC_SITE_URL=          # QR이 가리킬 주소. 비우면 요청 호스트

# 서버 전용 — NEXT_PUBLIC_ 접두어를 붙이지 않는다
PRIVY_APP_ID=
PRIVY_APP_SECRET=
OPERATOR_PASSCODE=
DATABASE_URL=
PINATA_JWT=
AVALANCHE_RPC_URL=
MINTER_PRIVATE_KEY=
```

민터 개인키, RPC URL, IPFS 토큰에 **`NEXT_PUBLIC_`을 붙이면 안 됩니다.** 브라우저 번들에 들어갑니다.

---

## 구현 시 주의

- **`MINTED`는 영수증 성공 뒤에만.** 전송만으로 올리면 실패한 발행이 진열장에 놓입니다. `simulateContract → writeContract → waitForTransactionReceipt` 순서를 지키세요.
- **`tokenId`는 문자열로.** `uint256`을 JSON에 넣기 전에 `toString()`. 숫자로 내리면 큰 값에서 정밀도가 깨집니다.
- **`tokenId`는 `CertificateIssued` 이벤트에서 읽습니다.** 컨트랙트에 주소→토큰 역조회가 없습니다.
- **민팅은 직렬화하세요.** 민터 지갑이 하나라 동시 전송하면 nonce가 충돌합니다. Postgres `FOR UPDATE SKIP LOCKED`나 advisory lock을 쓰세요.
- **`mint` 전에 `hasBeenIssued(recipient) == false` 확인.** 주소당 한 장이며 소각 후에도 `true`로 남습니다.
- **오븐은 4자리입니다.** 동시에 `MINTING`이 4개를 넘어도 화면은 깨지지 않고 나머지가 작업대에서 기다립니다.
