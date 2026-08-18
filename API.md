# 시스템 API 계약

Avalanche Bakery 행사 시스템의 서버 인터페이스입니다. 프론트엔드, 백엔드, 컨트랙트 담당자가 같은 문서를
봅니다. 백엔드를 구현하실 분이 이 문서 하나로 시작할 수 있게 적었습니다.

문서 안에서 **`[결정 필요]`** 로 표시한 곳은 아직 정해지지 않은 것입니다. 정하는 사람이 여기를 고쳐
주세요.

타입 정의의 정본은 [`apps/web/lib/api/types.ts`](./apps/web/lib/api/types.ts)입니다. 이 문서와 타입이 어긋나면 타입이 맞습니다.
계약을 바꿔야 하면 그 파일을 먼저 고치고 알려 주세요. 화면 전체가 그 타입만 보고 있습니다.

백엔드가 붙기 전까지는 `apps/web/app/api/`의 인메모리 목 라우트가 같은 계약을 만족시킵니다. 백엔드가 준비되면
`NEXT_PUBLIC_API_BASE_URL`을 지정하고 목 라우트를 지우면 화면 코드는 그대로 동작합니다.

## 1. 역할 경계

**프론트엔드가 하는 것**

- 참가자 사진을 긴 변 1280px JPEG로 줄여서 업로드합니다(원본 3~5MB를 200KB 안팎으로).
- 이메일과 인증 코드 입력 화면, 사진·이름 입력, 제출 확인 화면.
- 행사장 TV: 접수 → 오븐 → 진열장 카드 이동, 진열장 쪽 넘기기, 참가 QR.
- 운영자 화면: 참가자 목록, 카드 내리기, 실패 재시도, 앞 화면 전환.
- `GET /api/state`를 1초마다 폴링합니다.

**프론트엔드가 하지 않는 것 — 백엔드가 해야 합니다**

- **컨트랙트 호출.** 민터 개인키는 서버에만 있습니다. 프론트에는 지갑 UI도, viem도 없습니다.
- **참가자 지갑 주소 배정과 보관.** 서버 커스터디로 결정했습니다. 참가자는 지갑을 모릅니다.
- **증서 메타데이터 JSON 생성과 IPFS 업로드.**
- **증서 이미지 합성.**
- **이메일 발송.**
- **사진과 상태의 영구 저장.**

컨트랙트 호출 규약은 [`contracts/INTEGRATION_GUIDE.md`](./contracts/INTEGRATION_GUIDE.md)가
정본입니다. Fuji에 이미 배포돼 있습니다: `0x67Ce0bb25ee58B6D000d209B051b9E846D0d6b36`

## 2. 엔드포인트

| 메서드 | 경로 | 호출자 | 인증 |
|---|---|---|---|
| `POST` | `/api/auth/request-code` | 참가자 | 없음 |
| `POST` | `/api/auth/verify` | 참가자 | 없음 |
| `GET` | `/api/auth/session` | 참가자 | 세션 쿠키 |
| `POST` | `/api/entries` | 참가자 | 세션 쿠키 |
| `GET` | `/api/entries` | 참가자 | 세션 쿠키 |
| `GET` | `/api/state` | TV·운영자 | **없음** |
| `GET` | `/api/photos/{entryId}` | 누구나 | 없음 |
| `GET` | `/api/certificates/{tokenId}` | 누구나 | 없음 |
| `POST` | `/api/admin/session` | 운영자 | 없음(로그인) |
| `PATCH` | `/api/admin/entries/{id}` | 운영자 | 운영자 세션 |
| `POST` | `/api/admin/entries/{id}/revoke` | 운영자 | 운영자 세션 |
| `POST` | `/api/admin/entries/{id}/reissue` | 운영자 | 운영자 세션 |
| `PATCH` | `/api/admin/show` | 운영자 | 운영자 세션 |

아래 세 개는 아직 프론트에 구현되어 있지 않습니다. 계약만 정해 둡니다.

- `GET /api/certificates/{tokenId}`
- `POST /api/admin/entries/{id}/revoke`
- `POST /api/admin/entries/{id}/reissue`

### `POST /api/auth/request-code`

```jsonc
// 요청
{ "email": "you@example.com" }
// 응답 200
{ "ok": true }
```

- 이메일 형식이 아니면 `INVALID_EMAIL`.
- 목 구현은 메일을 보내지 않고 응답에 `mockCode`를 함께 넣습니다. 화면은 그 값을 화면에 표시해 개발
  중에 코드를 확인합니다. 실제 구현에서는 이 필드를 내려주지 마세요.
- 코드 만료 시간과 재시도 제한은 정해져 있지 않습니다. 정하시면 알려 주세요. 화면에 안내 문구를
  넣겠습니다.

### `POST /api/auth/verify`

```jsonc
// 요청
{ "email": "you@example.com", "code": "961907" }
// 응답 200 + Set-Cookie
{ "participantId": "8b39b459-15a5-4a09-b332-8f4985f84e5d", "email": "you@example.com" }
```

```
set-cookie: bakery_participant=<participantId>; Path=/; Max-Age=43200; HttpOnly; SameSite=Lax
```

- 코드가 틀리면 `INVALID_CODE`.
- 목은 쿠키 값에 `participantId`를 그대로 넣습니다. 실제 구현은 서명된 토큰을 쓰세요.
- 같은 이메일로 다시 인증하면 같은 `participantId`를 돌려줘야 합니다. 참가자가 폰을 바꾸거나 브라우저를
  지웠을 때 자기 제출로 돌아올 수 있어야 합니다.

### `GET /api/auth/session`

응답은 `verify`와 같습니다. 쿠키가 없거나 만료면 `401 UNAUTHENTICATED`입니다.
화면은 이 401을 **정상 흐름**으로 다룹니다(로그인 화면을 띄웁니다). 에러 로그로 취급하지 마세요.

### `POST /api/entries`

`multipart/form-data`

| 필드 | 형식 | 검증 |
|---|---|---|
| `photo` | 파일 | 4MB 이하, `image/jpeg` `image/png` `image/webp` |
| `nickname` | 문자열 | 1~12자, 앞뒤 공백 제거 |

```jsonc
// 응답 201
{
  "id": "859e2b03-f1a0-42a0-9f1e-8f596d8e89b9",
  "nickname": "참가01",
  "status": "SUBMITTED",
  "photoUrl": "/api/photos/859e2b03-f1a0-42a0-9f1e-8f596d8e89b9",
  "certificateUrl": null,
  "tokenId": null,
  "txHash": null,
  "shelfIndex": 0,
  "hidden": false,
  "failureReason": null,
  "submittedAt": "2026-08-18T16:33:35.029Z"
}
```

- 이미 제출한 참가자면 `409 ALREADY_SUBMITTED`. 한 사람당 한 장입니다.
- 정원이 차면 `409 SHOWCASE_FULL`. 정원은 `MAX_ENTRIES`(현재 30)이며 진열장 두 쪽입니다.
- `shelfIndex`는 제출 순서대로 0부터 배정하고 **이후 절대 바꾸지 않습니다.**
- 프론트가 이미 JPEG로 재인코딩해서 보내므로 실제로 오는 것은 `image/jpeg`입니다. HEIC는 올라오지
  않습니다.

### `GET /api/entries`

내 제출 하나를 돌려줍니다. 아직 제출하지 않았으면 `200`에 `null`입니다(404가 아닙니다).
참가자 폰이 제출 뒤 3초마다 이 경로를 폴링해 발행 완료를 기다립니다.

### `GET /api/state`

행사장 TV와 운영자 화면이 **1초마다** 부릅니다. 캐시하지 마세요.

```jsonc
{
  "entries": [ /* Entry 배열, shelfIndex 오름차순 */ ],
  "show": { "layout": "LIVE", "qrVisible": true, "shelfPage": 0 },
  "counts": { "submitted": 1, "minted": 1 }
}
```

- **이 응답은 인증 없이 TV에서 열립니다. 참가자 이메일을 넣지 마세요.** `Entry`에 이메일 필드가 없는
  이유입니다.
- `show`는 운영자가 바꾸는 화면 상태입니다. 서버가 들고 있어야 TV와 운영자 화면이 같은 것을 봅니다.
- `shelfPage`는 지금 TV에 보이는 진열장 쪽(0부터)입니다. 저절로 넘어가지 않고 사람이 넘깁니다.

### `GET /api/photos/{entryId}`

이미지 바이트를 그대로 돌려줍니다. `Entry.photoUrl`이 이 경로를 가리킵니다.

`photoUrl`을 다른 호스트의 절대 URL로 내려주셔도 됩니다. 참가자 화면과 운영자 화면은 값을 그대로
`<img src>`에 쓰고, TV는 `next/image`를 `unoptimized`로 쓰므로 외부 호스트도 그대로 열립니다.
주소가 정해지면 알려 주세요. 최적화를 켜려면 `apps/web/next.config.ts`에 호스트를 등록해야 합니다.

### `PATCH /api/admin/entries/{id}`

```jsonc
{ "hidden": true }   // 앞 화면에서 내리거나 다시 올린다
{ "retry": true }    // FAILED인 항목을 다시 시도한다
```

응답은 갱신된 `Entry`입니다. `retry`는 `status`가 `FAILED`일 때만 받습니다.

### `PATCH /api/admin/show`

```jsonc
{ "qrVisible": false }
{ "layout": "GALLERY" }   // 'LIVE' | 'GALLERY'
{ "shelfPage": 1 }
```

응답은 갱신된 `ShowState`입니다.

### `GET /api/certificates/{tokenId}` — 미구현

행사가 끝난 뒤에도 참가자가 자기 증서로 돌아올 수 있는 공개 경로입니다. 지금은 세션 쿠키 12시간이
전부라서 브라우저를 닫으면 증서를 다시 볼 방법이 없습니다.

```jsonc
// 응답 200 — 인증 없이 누구나 조회한다
{
  "tokenId": "1001",
  "nickname": "설탕별",
  "photoUrl": "https://.../photos/859e2b03",
  "certificateUrl": "https://.../certificates/1001.png",
  "txHash": "0x...",
  "mintedAt": "2026-08-19T05:12:00.000Z"
}
```

- 이메일이나 참가자 식별자를 넣지 마세요. 공개 경로입니다.
- 증서 메타데이터의 `external_url`이 이 주소를 가리킵니다.
- **`[결정 필요]`** 발행이 끝났을 때 참가자에게 이 링크를 이메일로 보낼지 정해야 합니다. 보내기로 하면
  참가자는 행사 뒤에도 증서를 찾을 수 있습니다.

### `POST /api/admin/session`

행사용 공유 비밀 하나로 운영자를 확인합니다.

```jsonc
// 요청
{ "passcode": "..." }
// 응답 200 + Set-Cookie
{ "ok": true }
```

```
set-cookie: bakery_operator=<sha256 hex>; Path=/; Max-Age=43200; HttpOnly; SameSite=Lax
```

- 비밀번호는 서버 환경변수 `OPERATOR_PASSCODE`입니다. **값이 비어 있으면 아무도 통과하지 못합니다.**
  설정을 잊었을 때 열리는 쪽이 아니라 잠기는 쪽으로 실패합니다.
- 쿠키에는 비밀번호가 아니라 `sha256('bakery-operator:' + passcode)`를 담습니다. 평문을 브라우저로
  보내지 않기 위한 것이며, 서버 상태 없이 검증할 수 있게 고정 해시를 씁니다.
- `GET /api/admin/session`으로 지금 들어와 있는지 확인합니다. 아니면 `401`입니다.
- 운영자 엔드포인트 네 개는 이 쿠키가 없으면 `401 UNAUTHENTICATED`입니다.

**아직 없는 것**

- **시도 횟수 제한이 없습니다.** 짧은 비밀번호를 공개 주소에 두면 무작위 대입에 뚫립니다. 공개
  배포에서는 충분히 긴 값을 쓰세요.
- `Secure` 플래그를 붙이지 않았습니다. 행사장에서 노트북의 HTTP LAN 주소로 열 수 있어야 하기
  때문입니다. HTTPS 배포에서는 붙이는 것이 낫습니다.

### `POST /api/admin/entries/{id}/revoke` — 미구현

이름이나 사진을 잘못 받았을 때 발행을 취소합니다. 컨트랙트의 `adminBurn(tokenId)`를 부릅니다.

```jsonc
// 요청
{ "reason": "참가자 요청으로 이름 정정" }
// 응답 200 — 갱신된 Entry
```

- 호출자는 `RECOVERY_ROLE`을 가진 관리자 지갑입니다. 서버 민터 키로는 못 부릅니다.
- 성공하면 `reissueAvailable(tokenId)`가 `true`가 되고 기존 토큰은 조회가 실패합니다.
- **`EntryStatus`에 `REVOKED`를 추가해야 합니다.** 지금 타입에는 없습니다. 진열장은 이 상태의 카드를
  내려야 합니다.

### `POST /api/admin/entries/{id}/reissue` — 미구현

취소한 증서를 고쳐서 다시 발행합니다. 컨트랙트의 `reissue(burnedTokenId, recipient, metadataURI)`를
부릅니다. **`revoke`와 반드시 별개의 트랜잭션입니다.**

```jsonc
// 요청 — multipart/form-data. 고칠 것만 보낸다
// nickname?: string, photo?: File
// 응답 201 — 새 tokenId를 가진 Entry
```

- 컨트랙트는 **항상 새 Token ID를 만듭니다.** 기존 번호를 재사용하지 않습니다. 참가자가 이미 `#1001`을
  봤다면 정정 뒤에는 다른 번호가 됩니다. 참가자에게 알려야 합니다.
- 하나의 소각 Token ID는 **한 번만** 재발급에 쓸 수 있습니다.
- 호출 전 `reissueAvailable(burnedTokenId) == true`와 `balanceOf(recipient) == 0`을 확인하세요.
- 메타데이터를 고치는 함수는 컨트랙트에 없습니다. 정정 경로는 이 두 단계뿐입니다.

### 오류 형식

```jsonc
{ "error": { "code": "INVALID_EMAIL", "message": "이메일 주소를 다시 확인해 주세요." } }
```

`message`는 **참가자에게 그대로 보여줍니다.** 화면은 이 문장을 다시 쓰지 않습니다. 한국어 완성 문장으로
주세요. `code`는 `ApiErrorCode`입니다.

| code | 상태 | 뜻 |
|---|---:|---|
| `INVALID_EMAIL` | 400 | 이메일 형식 아님 |
| `INVALID_CODE` | 400 | 인증 코드 불일치 |
| `UNAUTHENTICATED` | 401 | 참가자 또는 운영자 세션 없음·만료 |
| `ALREADY_SUBMITTED` | 409 | 이미 제출함 |
| `INVALID_PHOTO` | 400 | 사진 형식·크기 문제 |
| `INVALID_NICKNAME` | 400 | 이름 길이 문제 |
| `SHOWCASE_FULL` | 409 | 정원 초과 |
| `NOT_FOUND` | 404 | 없는 항목 |
| `INTERNAL` | 500 | 그 외 |

## 3. 상태 머신

```
SUBMITTED → RENDERED → PINNED → MINTING → MINTED
     └──────────┴──────────┴─────────┴──→ FAILED
```

| 상태 | 뜻 | 화면이 하는 일 |
|---|---|---|
| `SUBMITTED` | 사진과 이름을 받음 | TV 작업대에 카드가 떨어진다 |
| `RENDERED` | 증서 이미지 합성 완료 | 작업대에 머문다 |
| `PINNED` | 메타데이터 IPFS 업로드 완료 | 작업대에 머문다 |
| `MINTING` | 민팅 트랜잭션 전송, 영수증 대기 | **카드가 오븐으로 들어간다** |
| `MINTED` | 영수증 성공 + `CertificateIssued` 확인 | **카드가 진열장에 놓인다.** 참가자 폰에 증서가 뜬다 |
| `FAILED` | 어느 단계든 실패 | 참가자에게 "다시 보내야 해요", 운영자에게 재시도 버튼 |

지켜야 할 것:

- **`MINTED`는 영수증 성공 뒤에만 씁니다.** 트랜잭션 전송만으로 올리면 실패한 발행이 진열장에 놓입니다.
  `simulateContract → writeContract → waitForTransactionReceipt` 순서를 따르세요.
- **`tokenId`는 문자열입니다.** 컨트랙트가 주는 `uint256`을 JSON에 넣기 전에 `toString()`하세요.
  숫자로 내려주면 큰 값에서 정밀도가 깨집니다.
- **`tokenId`는 `CertificateIssued` 이벤트에서 읽습니다.** 컨트랙트에 주소로 토큰을 역조회하는 함수가
  없으므로 발급·소각·재발급 이벤트를 저장해야 합니다.
- **오븐은 4자리입니다.** 동시에 `MINTING`인 항목이 4개를 넘어도 화면은 깨지지 않고 나머지가 작업대에서
  기다립니다. 배치 민팅(최대 50)을 쓰셔도 됩니다.
- `FAILED`의 `failureReason`은 운영자용입니다. 참가자에게 그대로 보여주지 않습니다.
- 오발급 정정을 구현하면 `REVOKED`가 하나 더 필요합니다. `MINTED → REVOKED → (reissue) → MINTED`이며
  새 Token ID가 붙습니다. 지금 `EntryStatus`에는 없습니다.

## 4. 증서 메타데이터

컨트랙트의 `tokenURI(tokenId)`가 가리키는 JSON입니다. 백엔드가 만들어 IPFS에 올립니다.

**`[결정 필요]`** 아직 아무도 정하지 않았습니다. 아래는 제안입니다. 이 JSON이 지갑과 마켓플레이스에서
증서로 보이는 모습을 결정하므로 행사 전에 확정해야 합니다.

```jsonc
{
  "name": "Avalanche Bakery 참가 증서 #1001",
  "description": "2026년 8월 쿠키 클래스에서 설탕별이 구운 쿠키의 참가 증서입니다.",
  "image": "ipfs://<사진 또는 합성 증서 이미지 CID>",
  "external_url": "https://<서비스 주소>/certificates/1001",
  "attributes": [
    { "trait_type": "이름", "value": "설탕별" },
    { "trait_type": "행사", "value": "Avalanche Bakery" },
    { "trait_type": "발행일", "display_type": "date", "value": 1787000000 }
  ]
}
```

정해야 할 것:

- `image`에 참가자 원본 사진을 넣을지, 합성한 증서 이미지를 넣을지
- 참가자 이름을 `attributes`에 공개할지. **이 JSON은 영구 공개입니다.** 실명을 받는다면 다시 생각해야
  합니다
- `ipfs://` 스키마로 둘지 게이트웨이 HTTPS 주소로 둘지
- 메타데이터를 고칠 수 없다는 점(컨트랙트에 수정 함수가 없음)을 감안해 무엇을 넣지 않을지

## 5. 세션과 오리진

프론트는 모든 요청에 `credentials: 'include'`를 붙입니다.

**백엔드를 같은 오리진에 두면**(예: Next 라우트를 그대로 대체) 추가 설정이 없습니다.

**다른 오리진에 두면**(예: `api.example.com`) 이게 필요합니다:

- `Access-Control-Allow-Origin`에 프론트 오리진을 **정확히** 지정(`*`는 쿠키와 함께 못 씁니다)
- `Access-Control-Allow-Credentials: true`
- 세션 쿠키를 `SameSite=None; Secure`로
- `PATCH`와 `multipart` 프리플라이트 허용

## 6. 환경변수

프론트가 읽는 것:

```dotenv
# 운영자 화면(/admin) 비밀번호. 비어 있으면 아무도 들어갈 수 없다
OPERATOR_PASSCODE=

# 백엔드 주소. 비우면 같은 오리진의 목 라우트를 부른다
NEXT_PUBLIC_API_BASE_URL=

# 고정 도메인을 쓸 때 QR이 가리킬 주소. 비우면 요청 호스트를 그대로 쓴다
NEXT_PUBLIC_SITE_URL=

# 목 파이프라인의 단계별 실패 확률(0~1). 실패 화면 확인용. 기본 0
MOCK_FAILURE_RATE=
```

`apps/web/.env.example`을 복사해 `.env.local`을 만드세요. `.env*`는 커밋되지 않습니다.

민터 개인키, RPC URL, IPFS 토큰 같은 값은 **`NEXT_PUBLIC_`을 붙이면 안 됩니다.** 브라우저 번들에
들어갑니다.

## 7. 목 구현이 흉내내지 않는 것

`apps/web/app/api/`는 로컬 개발용입니다. 실제로 쓸 수 없는 이유:

- 상태와 사진이 프로세스 메모리에 있습니다. 재시작하면 사라지고, 서버리스에서는 인스턴스마다 다릅니다.
- 굽기 단계를 `setTimeout`으로 진행합니다. 서버리스에서는 응답 후 함수가 얼어서 돌지 않습니다.
- 컨트랙트를 호출하지 않습니다. `tokenId`와 `txHash`가 가짜입니다.
- 이메일을 보내지 않고 코드를 응답에 넣습니다.
- 컨트랙트 대신 `MOCK_FAILURE_RATE`(0~1)로 실패를 흉내냅니다. 실패 화면을 확인하려면 이 값을 올려서
  띄우세요. 기본값 0이라 평소에는 늘 성공합니다.

## 8. 개인정보

수집하는 것은 **이메일 주소**와 **참가자가 올린 사진**입니다.

**`[결정 필요]`** 보관 기간과 파기 시점이 정해지지 않았습니다. 사진은 증서 메타데이터로 IPFS에 올라가면
사실상 지울 수 없으므로, 참가자에게 제출 화면에서 그 사실을 알려야 합니다. 지금 제출 확인 화면은
"증서는 공개 기록으로 남아요"까지만 말합니다.

## 9. 구현 체크리스트

- [ ] 상태와 사진을 영구 저장소에 둔다
- [ ] 이메일 코드 발송, 만료 시간, 재시도 제한을 정한다
- [ ] 참가자 지갑 주소 배정·보관 방식을 정한다
- [ ] 증서 메타데이터 JSON을 만들고 IPFS에 올린다
- [ ] `mint` 호출 전 `hasBeenIssued(recipient)`가 `false`인지 확인한다
- [ ] 영수증 성공과 `CertificateIssued` 이벤트를 확인한 뒤에만 `MINTED`로 올린다
- [ ] `tokenId`를 문자열로 내려준다
- [ ] `GET /api/state`에 이메일이 섞이지 않는지 확인한다
- [ ] 실패 시 `FAILED`와 `failureReason`을 채우고 `retry`를 받는다
- [ ] 증서 메타데이터 JSON 형태를 확정한다(4절)
- [ ] 운영자 비밀번호에 시도 횟수 제한을 붙인다
- [ ] 오발급 정정 경로를 만든다(`revoke` → `reissue`, 별개 트랜잭션)
- [ ] 행사 뒤에도 참가자가 증서를 볼 수 있게 한다(`GET /api/certificates/{tokenId}`)
- [ ] 이메일과 사진의 보관 기간을 정한다(8절)
