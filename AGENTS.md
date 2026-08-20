# AGENTS.md

이 저장소에서 작업하는 사람과 에이전트를 위한 안내입니다.

## 문서 우선순위

작업 전에 이 순서로 읽으세요. **위가 아래를 이깁니다.**

| 순서 | 문서 | 무엇 |
|---:|---|---|
| 1 | `apps/web/lib/api/types.ts` | **화면 응답 모델**의 정본. `Entry`·`ShowState`가 문서와 다르면 코드가 맞습니다 |
| 2 | [API_REFERENCE.md](./API_REFERENCE.md) | 엔드포인트 목록과 요청·응답 |
| 3 | [PIPELINE.md](./PIPELINE.md) | 제출부터 민팅까지 백엔드가 하는 일 |
| 4 | [DECISIONS.md](./DECISIONS.md) | 확정된 결정과 근거 |
| 5 | [apps/web/db/README.md](./apps/web/db/README.md) | 테이블·제약·자주 쓸 쿼리. 스키마 정본은 옆의 `schema.sql` |
| 6 | [apps/web/app/admin/README.md](./apps/web/app/admin/README.md) | **운영자 화면 명세.** 행사 당일 시나리오와 만들 것 목록 |
| 7 | [contracts/INTEGRATION_GUIDE.md](./contracts/INTEGRATION_GUIDE.md) | 컨트랙트 호출 규약. 민팅 코드의 정본 |
| 8 | [API.md](./API.md) | 설계 배경과 역할 경계 |

> ⚠️ **인증은 예외입니다.** `types.ts`와 `apps/web/app/api/`의 참가자 인증은 아직 **Privy 전환 전**
> 구현(이메일+코드, `bakery_participant` 쿠키)입니다. 인증 계약은 코드가 아니라
> [API_REFERENCE.md](./API_REFERENCE.md)를 따르고, Privy를 붙일 때 타입과 목 라우트를 함께 교체합니다.
> 그때 `ApiErrorCode`에 `WALLET_NOT_FOUND`를 넣고 `INVALID_EMAIL`·`INVALID_CODE`를 지웁니다.

> ⚠️ **`EntryStatus`도 예외입니다 (2026-08-20~).** 문서가 코드보다 앞서 있습니다. 문서에는
> `JOINED`가 있고 `RENDERED`가 없는데 `types.ts`는 아직 반대입니다. **이 항목만은
> [API_REFERENCE.md](./API_REFERENCE.md)와 [DECISIONS.md](./DECISIONS.md)가 맞습니다.**
> 프론트가 아래 목록을 반영하면 이 단서를 지우세요.
>
> | 파일 | 할 일 |
> |---|---|
> | `lib/api/types.ts` | `EntryStatus`에 `JOINED` 추가, `RENDERED` 삭제, `certificateUrl` 제거 |
> | `components/display/displaySequence.ts` | `zone()` — `MINTED`→진열장, `JOINED`·`FAILED`→작업대, 나머지→오븐 |
> | `components/display/CookieCard.tsx` | `STATUS_LABEL`에서 `RENDERED` 빼고 `JOINED` 넣기 |
> | `app/join/JoinFlow.tsx` | Privy 구글 로그인으로 교체, **닉네임을 사진보다 앞으로**, 등록 요청 추가 |
> | `lib/photo.ts` | 프레임 합성 추가. **운영자 화면에서도 쓰므로 공용으로 둘 것** |
> | `app/api/` 목 라우트 | `POST /api/participants`, `POST /api/admin/entries/{id}/photo` |

## 이미 확정된 것 — 다시 정하지 마세요

근거는 [DECISIONS.md](./DECISIONS.md)에 있습니다.

- **참가자 인증은 Privy입니다.** 프론트에서 구글 로그인을 처리하고, 백엔드는 `Authorization: Bearer`로
  받은 Privy 토큰을 검증합니다. 이메일+인증코드 방식은 폐기됐습니다.
- **참가자 지갑은 Privy 임베디드 EOA입니다.** 서버 커스터디도, HD 시드 파생도 아닙니다.
- **지갑 주소는 서버가 Privy API로 조회합니다.** 클라이언트가 보낸 주소를 신뢰하지 마세요.
- **민팅은 건별 즉시, 직렬 처리입니다.** `batchMint`를 쓰지 않습니다.
- **증서 합성은 프론트가 합니다.** 브라우저 캔버스에서 프레임을 둘러 만들고 **합성본 한 장만**
  올립니다. 서버는 이미지를 다시 그리지 않고 받은 바이트를 그대로 핀합니다. 원본 사진은 서버로
  오지 않으며, `EntryStatus`의 `RENDERED`는 **없어졌습니다.**
- **카드는 로그인·닉네임 시점에 생깁니다.** 사진 제출 전에 `JOINED`로 만들어 TV 작업대에 올립니다.
  사진을 못 올리는 참가자를 운영자가 대신 처리할 수 있게 하기 위해서입니다.
- **TV 세 구역은 "누가 손대야 하는가"로 나뉩니다.** 작업대 = `JOINED`·`FAILED`(사람 손 필요),
  오븐 = `SUBMITTED`·`PINNED`·`MINTING`(기계가 처리 중), 진열장 = `MINTED`.
- **개발 네트워크는 Fuji(43113)입니다.** 메인넷 배포는 아직 없습니다.
- **메타데이터에 `external_url`과 `tokenId`를 넣지 않습니다.**
- **실명을 받지 않습니다.** 닉네임만 받습니다.

바꿔야 할 이유가 생기면 `DECISIONS.md`에 근거를 적고 담당자에게 확인받으세요. 문서를 조용히
고치거나 되돌리지 마세요.

## 계약을 바꿀 때

`apps/web/lib/api/types.ts`가 프론트·백엔드가 공유하는 계약입니다. 화면 전체가 이 타입만 봅니다.

1. `types.ts`를 먼저 고친다
2. 목 라우트(`apps/web/app/api/`)와 화면을 함께 맞춘다
3. `API_REFERENCE.md`를 갱신한다
4. 다른 담당자에게 알린다

## 목 서버

`apps/web/lib/server/store.ts`가 **백엔드 전체를 흉내내는 173줄**입니다. 참가자·카드·사진·화면
상태를 `globalThis`에 얹은 메모리 저장소이고, `schedulePipeline()`이 `setTimeout`으로 굽는
과정을 돌립니다. 덕분에 DB·Privy·Pinata·체인 없이 `npm run dev`만으로 전체 흐름이 돕니다.

**프론트 담당자는 이것만으로 개발합니다.** 아래처럼 환경변수가 없으면 목, 있으면 실제로 붙는
구조를 유지하세요. **프론트에 Postgres 설치를 요구하지 않습니다.**

| 없으면 | 있으면 |
|---|---|
| `DATABASE_URL` → 메모리 | Postgres |
| `PRIVY_APP_ID` → 목 인증 | Privy |
| `PINATA_JWT` → 가짜 CID | 실제 핀 |

목이 흉내내지 못하는 것은 [API.md](./API.md) 3절에 있습니다. 실제 구현으로 옮길 때
`setTimeout`은 `after()`로 바꿔야 합니다 — 서버리스에서는 응답 후 함수가 얼어붙습니다.

## 커밋하지 않는 것

비밀키, `.env`, keystore, Foundry 빌드 결과, 로컬 에이전트 문서. `.gitignore`를 확인하세요.

## 담당 경계

| 영역 | 무엇 | 담당 |
|---|---|---|
| 참가자·TV 화면 | `app/join/`, `app/display/`, `components/`, Privy 로그인 연동 | 프론트 |
| 운영자 화면 | `app/admin/` — **화면과 API 둘 다** | 백엔드 |
| 백엔드 | `app/api/`, DB, IPFS, 민팅 | 백엔드 |
| API 계약 문서 | `API_REFERENCE.md`·`PIPELINE.md`·`DECISIONS.md` | 백엔드 |
| 컨트랙트 | `contracts/` — 배포된 컨트랙트는 변경하지 않습니다 | — |

**공용 파일**은 만드는 쪽이 재사용 가능한 형태로 내줍니다. 자기 화면 전용으로 가두지 마세요.

| 파일 | 만드는 쪽 | 같이 쓰는 쪽 |
|---|---|---|
| `lib/photo.ts` — 자르기·프레임 합성 | 프론트 | 운영자 화면의 **대리 업로드**가 같은 합성을 씁니다 |
| `lib/api/types.ts` — 응답 계약 | 백엔드가 문서로 정하고 프론트가 반영 | 양쪽 |

`apps/demo/`는 흐름 확정용 프로토타입입니다. **더 이상 고치지 않습니다.**
