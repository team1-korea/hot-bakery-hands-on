# 작업 인수인계

> 2026-08-21 기준. 새 에이전트는 이 파일을 읽고, 세부 계약은 아래 정본 문서에서 확인하세요.

## 목표

8월 29일 행사에서 `apps/web`을 Vercel에 배포하고 Supabase·Pinata·Avalanche C-Chain·Privy를 연결해,
참가자 등록 → 증서 이미지 제출 → IPFS 핀 → NFT 민팅 → TV 진열과 운영자 복구가 끝까지 동작하게 합니다.

## 브랜치와 PR

- 현재 브랜치: `feat/backend-pipeline`
- 백엔드 후속 PR: [#11](https://github.com/team1-korea/hot-bakery-hands-on/pull/11)
- 프론트 API 계약 PR [#10](https://github.com/team1-korea/hot-bakery-hands-on/pull/10)은 이미 `main`에 머지됐습니다.
- PR #11 후속 작업으로 운영자 수동 복구 API·버튼과 문서가 작업 트리에 있습니다. 덮어쓰지 말고
  검증 후 같은 PR에 푸시하세요.

## 상태

### 완료·푸시됨

- 상태/API 설계 문서, Supabase 스키마와 DB 설명
- Postgres 저장소와 Supabase Storage 분기(환경변수 없으면 메모리 목)
- Privy 토큰 검증과 embedded EVM 지갑 조회(운영 설정 누락 시 fail-closed)
- Storage → Pinata 이미지·메타데이터 핀 → Fuji 민팅 → 영수증·이벤트 확인 파이프라인
- advisory lock 직렬화, `after()` 실행, 재시도·AlreadyIssued·스위퍼 복구
- 운영자 로그인, 명단, 화면 제어, 숨김, 실패 사유, 재시도, 대리 업로드
- 운영자 **멈춘 작업 점검/복구** 버튼과 Cron 공용 advisory-lock 스위퍼
- 메타데이터 핀 전 닉네임 수정과 `ALLOW_DB_RESET=1`로 잠근 DB·Storage 초기화
- API·파이프라인·DB·운영자·인수인계 문서의 코드 동기화
- 실제 Supabase·Storage·Pinata·Fuji E2E 검증 및 테스트 데이터 정리
- 확정된 3:4 NFT 디자인과 Pretendard Bold 닉네임 합성 적용

### 남은 작업

- 참가자 화면 Privy Google 로그인과 Bearer token 연결
- Vercel 배포, Supabase Cron 설정, 실제 환경 end-to-end 리허설
- 행사 전 데이터/Storage 정리와 운영 체크

## 환경변수(값은 문서나 Git에 쓰지 않음)

운영 필수:

`NEXT_PUBLIC_PRIVY_APP_ID`, `NEXT_PUBLIC_CERTIFICATE_FRAME_URL`, `PRIVY_APP_ID`,
`PRIVY_APP_SECRET`, `OPERATOR_PASSCODE`,
`DATABASE_URL`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_BUCKET`,
`PINATA_JWT`, `MINTER_PRIVATE_KEY`, `CRON_SECRET`

선택/기본값 있음:

`NEXT_PUBLIC_API_BASE_URL`, `NEXT_PUBLIC_SITE_URL`, `AVALANCHE_RPC_URL`,
`CERTIFICATE_ADDRESS`, `CERTIFICATE_DEPLOYMENT_BLOCK`, `MINT_GAS_LIMIT`

메인넷 운영 전환 시 필수:

`NEXT_PUBLIC_CHAIN_ID=43114`, `CERTIFICATE_ADDRESS`, `CERTIFICATE_DEPLOYMENT_BLOCK`

Fuji는 메인넷 주소·블록이 Vercel에 남아 있어도 커밋된 `deployments/43113.json`만 사용합니다.
메인넷 배포 직후 주소와 블록을 미리 등록합니다. 이 명령은 활성 체인을 바꾸지 않습니다.
행사 전환 때는 체인 ID만 바꾼 뒤 최신 `main`을 재배포합니다.

```bash
npm run chain:prepare-mainnet -- --address 0x... --block 12345678 --apply --confirm PREPARE
npm run chain:switch -- mainnet --apply --confirm 43114
npm run chain:switch -- fuji --apply --confirm 43113
```

개발 전용(운영 배포 금지): `MOCK_FAILURE_RATE`, `ALLOW_DB_RESET`

## 검증 명령

```bash
cd apps/web
npx tsc --noEmit
npm test
npm run lint
npm run build
```

> `DATABASE_URL`이 있으면 `npm test`가 실제 Supabase 테스트를 실행합니다. 테이블이 비어 있는
> 테스트/준비 환경에서만 실행하세요. 행사 데이터가 있으면 실행하지 마세요.

최종 검증은 `apps/web`의 서버·단위·E2E 테스트와 TypeScript·ESLint·Next build를 모두 실행합니다.
실제 Storage → Pinata → Fuji → DB `MINTED` E2E 뒤에는 생성한 DB·Storage·Pinata 테스트 데이터를
정리해야 합니다. 폐기 주소의 Fuji 테스트 NFT만 체인 특성상 남습니다.

## 알려진 블로커

- 참가자 화면의 Privy Google 로그인·Bearer token 연동
- Vercel에서 `after()` 실행과 Supabase의 `CRON_SECRET`/Cron 호출 검증

## 다음 에이전트 실행 순서

1. Vercel에 `NEXT_PUBLIC_CERTIFICATE_FRAME_URL`을 포함한 운영 환경변수를 설정한다.
2. Supabase에서 1분 Cron(`/api/internal/sweep`)을 연결한다.
3. Vercel `after()`를 포함한 한 명 end-to-end 리허설 뒤 DB·Storage를 비운다.
4. 행사 직전 Supabase 상태, 민터 권한·잔액, 운영자 로그인과 TV를 확인한다.

배포 설정을 마친 뒤 행사 중 복구 조작은 `/admin` 버튼으로 끝냅니다. Vercel·Privy·Supabase·Pinata
최초 설정과 민터 AVAX 충전만 외부 대시보드/지갑 작업입니다.

## 상세 정본

- 우선순위·결정: [AGENTS.md](./AGENTS.md), [DECISIONS.md](./DECISIONS.md)
- 프론트/API 계약: [API_REFERENCE.md](./API_REFERENCE.md)
- 발행 파이프라인: [PIPELINE.md](./PIPELINE.md)
- DB: [apps/web/db/README.md](./apps/web/db/README.md), [schema.sql](./apps/web/db/schema.sql)
- 운영자 화면: [apps/web/app/admin/README.md](./apps/web/app/admin/README.md)
- 체인: [contracts/INTEGRATION_GUIDE.md](./contracts/INTEGRATION_GUIDE.md)
