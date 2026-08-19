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
| 5 | [contracts/INTEGRATION_GUIDE.md](./contracts/INTEGRATION_GUIDE.md) | 컨트랙트 호출 규약. 민팅 코드의 정본 |
| 6 | [API.md](./API.md) | 설계 배경과 역할 경계 |

> ⚠️ **인증만은 예외입니다.** `types.ts`와 `apps/web/app/api/`의 참가자 인증은 아직 **Privy 전환 전**
> 구현(이메일+코드, `bakery_participant` 쿠키)입니다. 인증 계약은 코드가 아니라
> [API_REFERENCE.md](./API_REFERENCE.md)를 따르고, Privy를 붙일 때 타입과 목 라우트를 함께 교체합니다.
> 그때 `ApiErrorCode`에 `WALLET_NOT_FOUND`를 넣고 `INVALID_EMAIL`·`INVALID_CODE`를 지웁니다.

## 이미 확정된 것 — 다시 정하지 마세요

근거는 [DECISIONS.md](./DECISIONS.md)에 있습니다.

- **참가자 인증은 Privy입니다.** 프론트에서 구글 로그인을 처리하고, 백엔드는 `Authorization: Bearer`로
  받은 Privy 토큰을 검증합니다. 이메일+인증코드 방식은 폐기됐습니다.
- **참가자 지갑은 Privy 임베디드 EOA입니다.** 서버 커스터디도, HD 시드 파생도 아닙니다.
- **지갑 주소는 서버가 Privy API로 조회합니다.** 클라이언트가 보낸 주소를 신뢰하지 마세요.
- **민팅은 건별 즉시, 직렬 처리입니다.** `batchMint`를 쓰지 않습니다.
- **증서 이미지를 합성합니다.** 쿠키 사진에 프레임을 둘러 만들고, `EntryStatus`의 `RENDERED`를 씁니다.
  **IPFS에 올라가는 것은 합성본**이고 원본 사진은 우리 저장소에만 둡니다.
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

## 커밋하지 않는 것

비밀키, `.env`, keystore, Foundry 빌드 결과, 로컬 에이전트 문서. `.gitignore`를 확인하세요.

## 담당 경계

| 영역 | 무엇 |
|---|---|
| 프론트엔드 | `apps/web/app/`, `components/`, Privy 로그인 연동 |
| 백엔드 | `apps/web/app/api/`, DB, IPFS, 민팅 |
| 컨트랙트 | `contracts/` — 배포된 컨트랙트는 변경하지 않습니다 |

`apps/demo/`는 흐름 확정용 프로토타입입니다. **더 이상 고치지 않습니다.**
