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
| 6 | [apps/web/app/admin/README.md](./apps/web/app/admin/README.md) | **운영자 화면 명세.** 구현된 복구 기능과 행사 당일 시나리오 |
| 7 | [contracts/INTEGRATION_GUIDE.md](./contracts/INTEGRATION_GUIDE.md) | 컨트랙트 호출 규약. 민팅 코드의 정본 |
| 8 | [ARCHITECTURE.md](./ARCHITECTURE.md) | 설계 배경, 역할 경계, 남은 위험 |

참가자 인증, `JOINED` 상태와 세 구역 매핑, `certificateUrl` 제거는 코드에 반영됐습니다. 새 계약을
추가할 때만 아래 「계약을 바꿀 때」 순서를 따르세요.

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

## 목과 실제 백엔드

라우트는 하나이고 저장소 구현만 갈립니다. `store.ts`가 `DATABASE_URL` 유무에 따라
`store.memory.ts`(로컬 목)와 `store.pg.ts`(Supabase Postgres)를 선택합니다. 사진도 같은 방식으로
메모리 또는 Supabase Storage를 씁니다. 실제 DB 모드에서는 `pipeline.ts`가 Next.js `after()`로
Pinata 핀과 Fuji 민팅을 실행합니다.

**프론트 담당자는 외부 환경변수를 모두 비운 채 `npm run dev`만 실행합니다.** Postgres 설치는
필요 없습니다. 로컬에서 Privy 서버 변수를 모두 비우면 개발용 목 신원이 생기지만, 운영 환경이나
일부 변수만 설정된 상태에서는 인증이 fail-closed로 잠깁니다. 실제 배포는
[API_REFERENCE.md](./API_REFERENCE.md) 「환경변수」의 필수값을 한 세트로 넣으세요.

목과 실제 구현의 차이는 [ARCHITECTURE.md](./ARCHITECTURE.md) 「실행 모드」에 있습니다.

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
