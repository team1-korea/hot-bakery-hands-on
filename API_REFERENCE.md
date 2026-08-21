# API 레퍼런스

Avalanche Bakery 백엔드가 제공하는 엔드포인트 목록입니다.

- **Base URL**: 프론트와 같은 오리진. 분리하면 `NEXT_PUBLIC_API_BASE_URL`로 지정합니다.
- **타입 정본**: `apps/web/lib/api/types.ts`. 이 문서와 다르면 타입이 맞습니다.
- **배경 설명**은 [ARCHITECTURE.md](./ARCHITECTURE.md), 컨트랙트 호출은 [contracts/INTEGRATION_GUIDE.md](./contracts/INTEGRATION_GUIDE.md).

## 이 문서 읽는 법

| 보는 사람 | 읽을 곳 |
|---|---|
| **참가자·TV 화면 담당** | 「프론트가 부르는 것」 → 「참가자」 → 「공개」 → 「타입」 → 「오류 형식」. **「운영자」 앞에서 멈추면 됩니다** |
| **백엔드·운영자 화면 담당** | 전부 |

---

## 프론트가 부르는 것

**전부 다섯 개**입니다. 운영자 화면을 뺀 것이고, 참가자 폰과 행사장 TV가 씁니다.

### 참가자 폰 (`/join`)

```
구글 로그인 (Privy)          ← 백엔드 호출 없음
        ↓
POST /api/participants       닉네임 등록 → TV 작업대에 카드가 뜬다
        ↓
사진 촬영 · 자르기 · 프레임 합성   ← 전부 브라우저 안. 백엔드 호출 없음
        ↓
POST /api/entries            합성본 한 장 제출 → 카드가 오븐으로 들어간다
        ↓
GET /api/entries (3초 폴링)   MINTED가 되면 tokenId·txHash가 채워진다
```

| 메서드 | 경로 | 인증 | 언제 |
|---|---|---|---|
| `POST` | `/api/participants` | 참가자 | 로그인·닉네임 직후 **한 번** |
| `POST` | `/api/entries` | 참가자 | 합성이 끝난 뒤 **한 번** |
| `GET` | `/api/entries` | 참가자 | 등록 후 **3초마다** |

### 행사장 TV (`/display`)

| 메서드 | 경로 | 인증 | 언제 |
|---|---|---|---|
| `GET` | `/api/state` | 없음 | **1초마다** |
| `PATCH` | `/api/admin/show` | **운영자** | 진열장 쪽을 넘길 때 |

> ⚠️ **TV를 켜기 전에 그 브라우저에서 `/admin` 로그인을 먼저 하세요.**
> 진열장 페이저가 운영자 인증 엔드포인트를 부릅니다(`DisplayStage.tsx` → `updateShow`).
> 로그인이 없으면 쪽 넘기기만 `401`로 실패합니다. 화면 표시 자체는 영향받지 않습니다.
> 행사 당일 준비 체크리스트에 넣으세요.

### 이미지

**엔드포인트가 아닙니다.** `Entry.photoUrl`에 담겨 오는 URL을 `<img src>`에 그대로 쓰면 됩니다.
그 값이 우리 라우트일 수도, Supabase Storage 공개 URL일 수도 있습니다. **프론트는 구별하지
않습니다.** TV는 `next/image`를 `unoptimized`로 씁니다.

`photoUrl`이 `null`이면 아직 사진을 안 낸 카드(`JOINED`)입니다. **오류가 아닙니다** —
기본 쿠키 그림을 그리세요.

### Privy 없이 개발하기

로컬 개발(`NODE_ENV !== 'production'`)에서 Privy 설정 세 개
(`NEXT_PUBLIC_PRIVY_APP_ID`·`PRIVY_APP_ID`·`PRIVY_APP_SECRET`)를 **전부 비우면** 백엔드가
목 인증으로 돕니다. 토큰을 검증하지 않고 요청에 붙은 이름 하나로 참가자를 가르므로,
Privy 계정 없이도 화면 전체를 개발할 수 있습니다.

| 어떻게 | 값 |
|---|---|
| 헤더 | `x-dev-participant: alice` |
| 쿠키 | `bakery_dev_participant=alice` |
| 둘 다 없음 | 전부 같은 한 사람으로 취급 |

**같은 이름이면 항상 같은 참가자**입니다(이름을 해시해서 DID와 지갑 주소를 만듭니다).
새로고침해도 카드가 두 장 생기지 않고, 이름만 바꾸면 폰 여러 대를 흉내낼 수 있습니다.

```bash
# 참가자 두 명을 만들어 TV에 카드 두 장 띄우기
curl -X POST localhost:3000/api/participants \
  -H 'content-type: application/json' -H 'x-dev-participant: alice' \
  -d '{"nickname":"쿠키왕"}'

curl -X POST localhost:3000/api/participants \
  -H 'content-type: application/json' -H 'x-dev-participant: bob' \
  -d '{"nickname":"반죽왕"}'

# alice가 사진 제출 → 카드가 오븐으로
curl -X POST localhost:3000/api/entries \
  -H 'x-dev-participant: alice' -F 'photo=@cookie.jpg'
```

브라우저에서 여러 명을 흉내내려면 시크릿 창을 쓰거나 콘솔에서 쿠키를 바꾸세요.

```js
document.cookie = 'bakery_dev_participant=alice; path=/';
```

> 실제 Privy 검증은 백엔드에 구현돼 있습니다. 다만 **일부 값만 넣으면 목으로 돌아가지 않고
> `401`로 잠깁니다.** 실제 모드에서는 App ID와 Secret을 함께 설정하고, 프론트가 받은 access
> token을 Bearer 헤더로 보내야 합니다. 운영(`NODE_ENV=production`)은 세 값이 모두 없어도 목으로
> 열리지 않고 `401`로 실패합니다.

### 화면을 채워 보려면

TV 애니메이션을 확인하려면 카드가 여러 상태로 흩어져 있어야 합니다.

| 보고 싶은 것 | 방법 |
|---|---|
| 작업대에 대기 카드 | 등록만 하고 사진을 안 냅니다 (`JOINED`) |
| 오븐 → 진열장 이동 | 사진을 제출하면 목 파이프라인이 약 7.6초에 걸쳐 굽습니다 |
| 실패 카드 | `.env.local`에 `MOCK_FAILURE_RATE=1` |
| 진열장 두 쪽 | 15장 넘게 제출합니다 |
| 처음부터 다시 | `DATABASE_URL`이 없으면 **서버 재시작**으로 비워집니다 |

`DATABASE_URL`이 있으면 Postgres에 남습니다. 그때는 운영자 화면의 초기화 버튼을 쓰거나
`apps/web/db/reset.sql`을 돌리세요.

### 폴링 주기

| 화면 | 경로 | 주기 |
|---|---|---|
| TV | `GET /api/state` | 1초 |
| 참가자 폰 | `GET /api/entries` | 3초 |
| 운영자 화면 | `GET /api/admin/state` | 1초 |

캐시하지 마세요. `GET /api/state`는 `force-dynamic`입니다.

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

> 백엔드의 Privy token 검증과 embedded EVM 지갑 조회는 구현돼 있습니다. 프론트는 Privy Google
> 로그인 뒤 받은 access token을 아래 헤더로 붙여야 합니다. 계정 없이 화면만 개발할 때는 위
> 「Privy 없이 개발하기」의 로컬 목 인증을 쓰세요.

1. 프론트엔드가 Privy Google 로그인을 실행한다
2. Privy가 참가자에게 embedded EVM 지갑을 만들고 Google 계정과 연결한다
3. 프론트엔드가 Privy access token을 참가자 API 요청에 붙인다
4. 백엔드가 Privy 서버 SDK로 토큰의 **서명·만료·앱 ID**를 검증하고 Privy DID를 얻는다
5. 백엔드가 검증된 사용자의 linked accounts에서 **embedded EVM 지갑 주소를 확인한다**
   (Privy Users API 조회)
6. 최초 등록(`POST /api/participants`) 때 DID와 `walletAddress`를 저장하고, 이후 조회는 검증된 DID로 찾는다

```http
Authorization: Bearer <privy-access-token>
```

> ⚠️ **지갑 주소를 클라이언트에서 받아 그대로 믿지 마세요.** 임의의 주소로 민팅시킬 수 있습니다.
> 프론트가 주소를 함께 보내더라도 Privy에서 확인한 linked wallet과 일치하는지 검증해야 합니다.

구현 기준 문서: [access token](https://docs.privy.io/authentication/user-authentication/access-tokens)

**오류**

| 상황 | 응답 |
|---|---|
| 토큰 없음·잘못됨·만료 | `401 UNAUTHENTICATED` |
| embedded EVM 지갑을 못 찾음 | `400 WALLET_NOT_FOUND` |

401은 화면이 Privy 로그인을 다시 요청하는 **정상 흐름**입니다. 에러 로그로 취급하지 마세요.

---

## 엔드포인트 목록

| 메서드 | 경로 | 인증 | 부르는 화면 | 용도 |
|---|---|---|---|---|
| `POST` | `/api/participants` | 참가자 | 폰 | **등록.** 닉네임을 넘기고 카드를 만든다 |
| `GET` | `/api/entries` | 참가자 | 폰 | 내 항목 조회 |
| `POST` | `/api/entries` | 참가자 | 폰 | 합성 증서 제출 |
| `GET` | `/api/state` | 없음 | **TV** | 공개 화면 폴링 |
| `GET` | `/api/photos/{entryId}` | 없음 | 전부 | 증서 이미지 바이트 |
| `PATCH` | `/api/admin/show` | 운영자 | **TV**·운영자 | 앞 화면 전환·쪽 넘기기 |
| `GET` | `/api/admin/state` | 운영자 | 운영자 | **운영자 명단.** 실패 사유 포함 |
| `POST` | `/api/admin/session` | 없음 | 운영자 | 로그인 |
| `GET` | `/api/admin/session` | 운영자 | 운영자 | 로그인 상태 확인 |
| `DELETE` | `/api/admin/session` | 운영자 | 운영자 | 로그아웃 |
| `PATCH` | `/api/admin/entries/{id}` | 운영자 | 운영자 | 카드 내리기·재시도 |
| `POST` | `/api/admin/entries/{id}/photo` | 운영자 | 운영자 | **대리 업로드.** 참가자 대신 증서를 올린다 |
| `POST` | `/api/admin/reset` | 운영자 | 운영자 | 테스트 데이터 삭제. `ALLOW_DB_RESET=1`일 때만 존재 |
| `GET`·`POST` | `/api/internal/sweep` | `CRON_SECRET` | 스케줄러 | 멈춘 파이프라인 복구·방치 카드 정리 |

**TV가 `PATCH /api/admin/show`를 부릅니다.** 그래서 TV 브라우저에도 운영자 로그인이 필요합니다.

---

## 참가자

### `POST /api/participants`

**등록입니다.** 구글 로그인을 마치고 닉네임을 넣은 직후에 부릅니다. **사진보다 먼저입니다.**
여기서 `entries` 행이 만들어지고 TV 작업대에 카드가 올라갑니다.

```jsonc
// 요청
{ "nickname": "쿠키왕" }
```

서버가 하는 일:

1. Privy 토큰을 검증하고 DID를 얻는다
2. Privy 서버 API로 **임베디드 지갑 주소를 조회한다** — 클라이언트가 보낸 주소는 받지 않습니다
3. `participants` 행을 찾거나 만든다
4. `entries` 행을 `JOINED`로 만든다. **`shelfIndex`는 null입니다**

```jsonc
// 201
{
  "id": "859e2b03-f1a0-42a0-9f1e-8f596d8e89b9",
  "nickname": "쿠키왕",
  "status": "JOINED",
  "photoUrl": null,
  "tokenId": null,
  "txHash": null,
  "shelfIndex": null,
  "hidden": false,
  "failureReason": null,
  "submittedAt": "2026-08-19T05:10:00.000Z"
}
```

**오류**

| 상황 | 응답 |
|---|---|
| 토큰 없음·잘못됨·만료 | `401 UNAUTHENTICATED` |
| embedded EVM 지갑을 못 찾음 | `400 WALLET_NOT_FOUND` |
| 닉네임 길이 문제 | `400 INVALID_NICKNAME` |

이미 등록된 DID면 **기존 행을 그대로 돌려줍니다**(`200`). 새로 만들지 않습니다 — 참가자가 새로고침
하거나 다시 로그인해도 카드가 두 장 생기면 안 됩니다.

> **`shelfIndex`를 여기서 배정하지 마세요.** 로그인만 하고 사라진 사람이 진열장 칸을 영구히
> 점유합니다. 배정은 사진 제출 때 합니다.

---

### `GET /api/entries`

내 항목 하나를 돌려줍니다. 아직 등록하지 않았으면 **`200`에 `null`**입니다 (404가 아닙니다).
등록만 하고 사진을 안 냈으면 `status`가 `JOINED`이고 `photoUrl`이 null입니다.

등록 후 참가자 폰이 **3초마다** 이 경로를 폴링합니다. 제출 전에는 자기 카드가 작업대에 있음을,
제출 후에는 발행 완료를 확인합니다.

```http
GET /api/entries
Authorization: Bearer eyJhbGci...
```

```jsonc
// 200 — 제출까지 마치고 발행된 경우
{
  "id": "859e2b03-f1a0-42a0-9f1e-8f596d8e89b9",
  "nickname": "쿠키왕",
  "status": "MINTED",
  "photoUrl": "/api/photos/859e2b03-f1a0-42a0-9f1e-8f596d8e89b9",
  "tokenId": "1001",
  "txHash": "0x4f3c8a...",
  "shelfIndex": 0,
  "hidden": false,
  "failureReason": null,
  "submittedAt": "2026-08-19T05:12:00.000Z"
}
```

```jsonc
// 200 — 아직 등록하지 않음
null
```

---

### `POST /api/entries`

**프레임 합성이 끝난 증서 이미지**를 제출합니다. **한 사람당 한 장**입니다.
`POST /api/participants`로 등록된 `JOINED` 행을 `SUBMITTED`로 올립니다.

`Content-Type: multipart/form-data`

| 필드 | 형식 | 검증 |
|---|---|---|
| `photo` | 파일 | 4MB 이하, `image/jpeg` `image/png` `image/webp` |

**닉네임은 받지 않습니다.** 등록 때 이미 받았습니다.

**서버는 이 이미지를 다시 그리지 않습니다.** 프론트가 정사각형 자르기(최대 1080px JPEG)와 프레임
합성을 모두 끝내서 보냅니다. 실제로 오는 것은 `image/jpeg` 200KB 안팎이며 HEIC는 올라오지 않습니다.
받은 바이트를 그대로 저장하고 그대로 핀하세요 — 재인코딩하면 참가자가 확인 화면에서 본 증서와
체인에 박히는 증서가 달라집니다.

> 필드 이름이 `photo`지만 내용물은 **합성된 증서**입니다. 원본 사진은 서버로 오지 않습니다.

```http
POST /api/entries
Authorization: Bearer eyJhbGci...
Content-Type: multipart/form-data

photo=<binary>
```

```jsonc
// 201
{
  "id": "859e2b03-f1a0-42a0-9f1e-8f596d8e89b9",
  "nickname": "쿠키왕",
  "status": "SUBMITTED",
  "photoUrl": "/api/photos/859e2b03-f1a0-42a0-9f1e-8f596d8e89b9",
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
| 이미 사진을 낸 참가자 | `409 ALREADY_SUBMITTED` |
| 등록하지 않은 참가자 | `404 NOT_FOUND` — `POST /api/participants`를 먼저 부르세요 |
| 정원(30) 초과 | `409 SHOWCASE_FULL` |
| 사진 형식·크기 문제 | `400 INVALID_PHOTO` |

`ALREADY_SUBMITTED`는 **행의 존재가 아니라 사진 유무로** 판정합니다. 등록만 한 참가자는 행이
있어도 제출할 수 있어야 합니다.

`shelfIndex`는 **여기서** 제출 순서대로 0부터 배정하고 **이후 절대 바꾸지 않습니다.** 등록
시점이 아닙니다.

---

## 공개

### `GET /api/state`

행사장 TV가 **1초마다** 부릅니다. 운영자 화면은 실패 사유와 지갑 주소가 포함된
`GET /api/admin/state`를 따로 폴링합니다. 캐시하지 마세요.

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

## 타입

### `Entry`

```ts
type Entry = {
  id: string;
  nickname: string;
  status: EntryStatus;
  photoUrl: string | null;         // 프론트가 합성한 증서 이미지. JOINED에서는 null
  tokenId: string | null;          // uint256이므로 문자열
  txHash: string | null;
  shelfIndex: number | null;       // 진열장 슬롯(0-based). JOINED에서는 null,
                                   // 사진 제출 때 배정되고 이후 불변
  hidden: boolean;                 // 운영자가 TV에서 내린 카드
  failureReason: string | null;    // FAILED일 때만. 참가자에게 보여주지 않음
  submittedAt: string;             // ISO 8601
};
```

### `EntryStatus`

```
JOINED → SUBMITTED → PINNED → MINTING → MINTED
   └─────────┴──────────┴─────────┴──→ FAILED
```

| 상태 | 뜻 | 화면 |
|---|---|---|
| `JOINED` | 로그인·닉네임 등록 완료. 사진은 아직 없음 | TV 작업대에 카드가 떨어진다 |
| `SUBMITTED` | 합성 증서를 받음 | **카드가 오븐으로 들어간다** |
| `PINNED` | 증서와 메타데이터 IPFS 핀 완료 | 오븐에 머문다 |
| `MINTING` | 민팅 트랜잭션 전송, 영수증 대기 | 오븐에 머문다 |
| `MINTED` | 영수증 성공 + `CertificateIssued` 확인 | 카드가 진열장에 놓인다 |
| `FAILED` | 어느 단계든 실패 | 작업대로 돌아온다. 운영자에게 재시도 버튼 |

세 구역은 **누가 손대야 하는가**로 나뉩니다 — 작업대(`JOINED`·`FAILED`)는 사람 손이 필요한 것,
오븐(`SUBMITTED`·`PINNED`·`MINTING`)은 기계가 처리 중인 것, 진열장(`MINTED`)은 끝난 것입니다.
자세한 것은 [PIPELINE.md](./PIPELINE.md)를 보세요.

> `JOINED` 카드에는 `photoUrl`이 없습니다. **오류가 아닙니다.** 프론트가 기본 쿠키 그림을 그립니다.

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
| `ALREADY_SUBMITTED` | 409 | 이미 사진을 냄 |
| `INVALID_PHOTO` | 400 | 사진 형식·크기 문제 |
| `INVALID_NICKNAME` | 400 | 닉네임 길이 문제 |
| `INVALID_REQUEST` | 400 | 요청 본문·조작 형식 문제 |
| `SHOWCASE_FULL` | 409 | 정원 초과 |
| `NOT_FOUND` | 404 | 없는 항목 |
| `INTERNAL` | 500 | 그 외 |

---

<!-- ─────────── 프론트는 여기까지 보면 됩니다 ─────────── -->

## 운영자

> 이 아래는 **운영자 화면 담당(=백엔드)** 몫입니다. 참가자·TV 화면에는 필요 없습니다.
> 다만 `PATCH /api/admin/show`만은 TV도 부릅니다(위 「행사장 TV」 참고).

비밀번호는 서버 환경변수 `OPERATOR_PASSCODE`입니다. **비어 있으면 아무도 통과하지 못합니다** — 설정을 잊었을 때 열리는 쪽이 아니라 잠기는 쪽으로 실패합니다.

쿠키에는 비밀번호가 아니라 `sha256('bakery-operator:' + passcode)`를 담습니다.

### `GET /api/admin/state`

**운영자 화면은 공개 `GET /api/state`가 아니라 이것을 폴링합니다.** 1초 주기.

공개 응답에는 넣을 수 없는 것들이 여기에는 들어갑니다.

```jsonc
// 200
{
  "entries": [
    {
      // 공개 Entry의 모든 필드에 더해
      "failureReason": "IPFS 업로드 실패: 504",   // 왜 실패했는지
      "walletAddress": "0x10dd...f608",          // 체인에서 대조할 때
      "autoHidden": true,                         // 스위퍼가 내린 것인지
      "nicknameEditable": false                   // metadata CID가 없어 수정 가능한지
    }
  ],
  "show": { "layout": "LIVE", "qrVisible": true, "shelfPage": 0 },
  "counts": { "submitted": 12, "minted": 9 },
  "capabilities": {
    "resetDatabase": false,                       // 서버가 초기화를 허용하는지
    "mockServer": false                           // 메모리 목 저장소인지
  }
}
```

화면은 환경변수를 추측하지 말고 `capabilities`만 보고 초기화 버튼과 목 서버 배지를 표시합니다.

**왜 엔드포인트를 나누나.** 공개 `GET /api/state`는 인증이 없어 TV URL을 아는 사람이면
누구나 봅니다. 그렇다고 같은 엔드포인트가 운영자 쿠키 여부에 따라 다른 것을 뱉게 만들면,
나중에 캐시 헤더 한 줄이나 CDN 설정 하나만 잘못돼도 그대로 샙니다. **분리하는 편이
안전합니다.**

운영자 화면이 `failureReason`을 보지 못하면 행사 당일 **무엇이 왜 실패했는지 알 수 없어
대응을 고를 수 없습니다.** 실패 사유에 따라 할 일이 다릅니다 — 재시도로 되는 것, 가스를
채워야 하는 것, 새 사진을 받아야 하는 것, 그리고 **절대 재시도하면 안 되는 것**
(`AlreadyIssued`).

`hidden`은 **TV에서만** 감춥니다. 이 응답에서는 **내려간 카드도 그대로 내려보내세요** —
나중에 그 참가자가 사진을 가져오면 다시 올려야 합니다.

---

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
`hidden`은 boolean, `retry`는 `true`여야 하며 지원하는 필드가 없는 본문은 `400 INVALID_REQUEST`입니다.
잘못된 본문을 `{ hidden: false }`로 간주해 카드를 다시 올리지 않습니다.

**`retry`는 처음부터 다시 하지 않습니다.** 남아 있는 것을 보고 실패한 지점부터 재개합니다.

| 남아 있는 것 | 재개 지점 |
|---|---|
| `metadata_cid` | 민팅부터 |
| `certificate_cid`만 | 메타데이터 핀부터 |
| `certificate_path`만 | 증서 이미지 핀부터 |

> ⚠️ **`AlreadyIssued` 판단을 운영자에게 넘기지 않습니다.** 트랜잭션이 이미 성공했는데 DB
> 갱신 전에 함수가 죽었을 수 있습니다. 재시도 요청을 받으면 서버가 `CertificateIssued` 이벤트를
> `recipient`로 조회해 `tokenId`를 건져 `MINTED`로 마무리합니다.
> 절차는 [PIPELINE.md](./PIPELINE.md)에 있습니다.

**`hidden`을 다시 올릴 때 `auto_hidden_at`을 지우지 마세요.** 스위퍼가 또 내립니다.

---

### `PATCH /api/admin/entries/{id}` — 닉네임 수정

```jsonc
{ "nickname": "쿠키왕" }   // 1~12자, 앞뒤 공백 제거
```

**`PINNED` 이후에는 `409 ALREADY_SUBMITTED`로 거절합니다.** 닉네임이 메타데이터 JSON에 들어가고
그 JSON은 `PINNED`에서 IPFS에 올라갑니다. 컨트랙트에 메타데이터 수정 함수가 없으므로, 그
뒤에 DB만 고치면 **화면과 증서가 영영 달라집니다.** 못 고친다고 말하는 편이 낫습니다.

`metadata_cid`가 비어 있는지로 판정하세요. 상태 이름으로 판정하면 `FAILED` 건에서 틀립니다 —
메타데이터 핀까지 끝내고 민팅에서 실패한 카드는 이미 늦었습니다.

---

### `POST /api/admin/reset`

**테스트 데이터를 전부 지웁니다.** 준비 기간에만 씁니다.

```jsonc
// 200
{ "deleted": { "participants": 12, "entries": 12 } }
```

> ⚠️ **`ALLOW_DB_RESET=1`일 때만 존재합니다.** 없으면 `404 NOT_FOUND`입니다.
> **운영 배포에는 이 변수를 넣지 마세요.** 행사 당일 실수로 눌리면 그때까지의 참가자 카드가
> 전부 사라집니다.

지우는 것은 `participants`(cascade로 `entries`), 저장된 이미지, 그리고 `show_state` 초기화입니다.
**IPFS 핀과 체인 발행은 지울 수 없습니다** — 특히 발행된 주소는 `hasBeenIssued`가 계속 `true`라
그 사람은 다시 받지 못합니다. 테스트 민팅은 매번 새 주소로 하세요.

---

### `POST /api/admin/entries/{id}/photo`

**운영자 대리 업로드입니다.** 참가자가 사진을 못 올릴 때 운영자가 대신 올려 파이프라인을
시작합니다. `JOINED`(또는 `FAILED`) 행을 `SUBMITTED`로 올립니다.

`Content-Type: multipart/form-data`, 필드는 `photo` 하나. 참가자 제출과 같습니다.

**`JOINED`와 `FAILED` 모두에서 받습니다.** 사진이 문제였던 실패는 재시도로 해결되지 않고
새 사진을 받아야 합니다.

> ⚠️ **`FAILED` 건에 새 사진을 올릴 때는 `certificate_cid`와 `metadata_cid`를 비우세요.**
> 그것들은 **이전 이미지**의 CID입니다. 안 비우면 재개 로직이 핀을 건너뛰고 **옛 사진으로
> 민팅합니다.**

> **운영자 화면에서도 프레임 합성을 거쳐야 합니다.** 서버는 이미지를 다시 그리지 않으므로,
> 운영자가 원본 사진을 고르면 그 화면에서 참가자와 같은 합성을 한 뒤 보내야 합니다.
> `lib/photo.ts`를 재사용하세요.

응답은 `POST /api/entries`와 같은 `Entry`입니다.

| 상황 | 응답 |
|---|---|
| 없는 항목 | `404 NOT_FOUND` |
| 이미 사진이 있음 | `409 ALREADY_SUBMITTED` |
| 정원(30) 초과 | `409 SHOWCASE_FULL` |
| 사진 형식·크기 문제 | `400 INVALID_PHOTO` |

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

## 환경변수

```dotenv
# 브라우저
NEXT_PUBLIC_PRIVY_APP_ID=
NEXT_PUBLIC_API_BASE_URL=      # 비우면 같은 오리진
NEXT_PUBLIC_SITE_URL=          # QR이 가리킬 주소. 비우면 요청 호스트

# 운영 서버 필수 — NEXT_PUBLIC_ 접두어를 붙이지 않는다
PRIVY_APP_ID=
PRIVY_APP_SECRET=
OPERATOR_PASSCODE=
DATABASE_URL=
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
SUPABASE_BUCKET=certificates
PINATA_JWT=
MINTER_PRIVATE_KEY=
CRON_SECRET=                  # /api/internal/sweep Bearer 인증

# 선택값(기본값 있음)
AVALANCHE_RPC_URL=            # 비우면 Fuji 공개 RPC
CERTIFICATE_ADDRESS=          # 비우면 deployments/43113.json
MINT_GAS_LIMIT=               # 비우면 300000

# 로컬·준비 환경 전용. 운영 Vercel에는 넣지 않는다
MOCK_FAILURE_RATE=
ALLOW_DB_RESET=
```

비밀키와 토큰에 **`NEXT_PUBLIC_`을 붙이면 안 됩니다.** 브라우저 번들에 들어갑니다. 운영에서는
Privy 서버 변수 중 하나라도 빠지면 목 인증으로 열리지 않고 `401`로 잠깁니다. `DATABASE_URL`이
없는 로컬 개발만 메모리 목 파이프라인을 사용합니다.

### `GET|POST /api/internal/sweep`

Vercel Cron 또는 외부 스케줄러가 1분마다 호출하는 내부 복구 엔드포인트입니다.

```http
Authorization: Bearer <CRON_SECRET>
```

`CRON_SECRET`이 없거나 값이 다르면 `401 UNAUTHENTICATED`입니다. 멈춘 파이프라인은 영수증·이벤트를
먼저 복구한 뒤 실패 처리하고, 오래된 `JOINED` 카드는 TV에서 자동으로 내립니다. 운영 배포에서
Cron 일정을 따로 설정해야 하며, 라우트가 존재하는 것만으로 주기 실행되지는 않습니다.

---

## 구현 시 주의

- **요청 응답 뒤 작업은 `after()`로 실행합니다.** 참가자 제출·운영자 대리 업로드·재시도 라우트가 모두 같은 파이프라인을 예약합니다.
- **`MINTED`는 영수증 성공 뒤에만.** 전송만으로 올리면 실패한 발행이 진열장에 놓입니다. `simulateContract → writeContract → waitForTransactionReceipt` 순서를 지키세요.
- **`tokenId`는 문자열로.** `uint256`을 JSON에 넣기 전에 `toString()`. 숫자로 내리면 큰 값에서 정밀도가 깨집니다.
- **`tokenId`는 `CertificateIssued` 이벤트에서 읽습니다.** 컨트랙트에 주소→토큰 역조회가 없습니다.
- **민팅은 직렬화하세요.** 민터 지갑이 하나라 동시 전송하면 nonce가 충돌합니다. Postgres `FOR UPDATE SKIP LOCKED`나 advisory lock을 쓰세요.
- **`mint` 전에 `hasBeenIssued(recipient) == false` 확인.** 주소당 한 장이며 소각 후에도 `true`로 남습니다.
- **오븐은 4자리입니다.** 오븐 상태(`SUBMITTED`·`PINNED`·`MINTING`)가 4개를 넘어도 화면은 깨지지 않고 나머지가 작업대에서 기다립니다.
- **받은 이미지를 다시 그리지 마세요.** 프론트가 합성한 바이트를 그대로 저장하고 그대로 핀합니다.
- **`shelfIndex`는 등록이 아니라 사진 제출 때 배정합니다.** 등록 때 배정하면 이탈자가 진열장에 구멍을 남깁니다.
- **오래 방치된 `JOINED` 행을 `hidden`으로 내리세요.** 안 그러면 작업대가 유령 카드로 찹니다.
