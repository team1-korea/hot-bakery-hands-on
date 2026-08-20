# 작업 인수인계

> 2026-08-21 기준. 새 에이전트는 이 파일을 읽고, 세부 계약은 아래 정본 문서에서 확인하세요.

## 목표

8월 29일 행사에서 `apps/web`을 Vercel에 배포하고 Supabase·Pinata·Avalanche Fuji·Privy를 연결해,
참가자 등록 → 증서 이미지 제출 → IPFS 핀 → NFT 민팅 → TV 진열과 운영자 복구가 끝까지 동작하게 합니다.

## 브랜치와 PR

- 현재 브랜치: `docs/admin-and-schema`
- PR: [#10](https://github.com/team1-korea/hot-bakery-hands-on/pull/10)
- 작업 트리에 여러 에이전트의 미커밋 변경이 있습니다. 먼저 `git status`와 diff를 확인하고 덮어쓰지 마세요.

## 상태

### 완료·커밋됨

- 상태/API 설계 문서, Supabase 스키마와 DB 설명
- Postgres 저장소와 Supabase Storage 분기(환경변수 없으면 메모리 목)
- Fuji 체인 모듈과 실제 민팅 검증, 고정 민팅 가스 한도
- 기본 운영자 구조: 로그인, 명단, 화면 제어, 숨김, 재시도, 대리 업로드 UI/API

### 진행 중(작업 트리, 검증·커밋 전)

- 백엔드: Privy 검증, Pinata, `after()` 파이프라인, 스위퍼/내부 라우트
- 운영자: 닉네임 수정, DB 초기화, `capabilities`, 세션 만료 처리
- 문서: 구현 완료 상태와 API 예제 정합성 정리

### 남은 작업

- 참가자 화면 Privy Google 로그인과 Bearer token 연결
- 디자인 프레임 에셋을 받은 뒤 `lib/photo.ts` 공용 합성 및 운영자 대리 업로드 연결
- Vercel 배포, Cron 설정, 실제 환경 end-to-end 리허설
- 행사 전 데이터/Storage 정리와 운영 체크

## 현재 에이전트 소유 범위

- `/root`: 총괄, 변경 통합, 테스트, 커밋·푸시·PR
- `/root/audit_backend`: 인증·파이프라인·저장소·테스트 감사/보완
- `/root/audit_admin`: 운영자 프론트·API 감사/보완
- `/root/audit_docs`: 문서 정합성, 프론트용 API 문서와 이 인수인계

## 환경변수(값은 문서나 Git에 쓰지 않음)

운영 필수:

`NEXT_PUBLIC_PRIVY_APP_ID`, `PRIVY_APP_ID`, `PRIVY_APP_SECRET`, `OPERATOR_PASSCODE`,
`DATABASE_URL`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_BUCKET`,
`PINATA_JWT`, `MINTER_PRIVATE_KEY`, `CRON_SECRET`

선택/기본값 있음:

`NEXT_PUBLIC_API_BASE_URL`, `NEXT_PUBLIC_SITE_URL`, `AVALANCHE_RPC_URL`,
`CERTIFICATE_ADDRESS`, `MINT_GAS_LIMIT`

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

## 알려진 블로커

- 실제 Privy 앱 자격증명과 프론트 로그인 연동
- 디자인 프레임 에셋·최종 캔버스 규격

## 다음 에이전트 실행 순서

1. `git status`와 각 에이전트 결과를 모아 충돌 없이 통합한다.
2. `npx tsc --noEmit` 오류를 0으로 만들고 닉네임·초기화·capabilities 계약을 맞춘다.
3. Privy/Pinata/파이프라인/스위퍼 단위 테스트와 빈 준비 DB의 통합 테스트를 통과시킨다.
4. 프론트 Privy와 프레임 합성을 연결한다.
5. 위 네 검증 명령을 통과시키고 API 문서·운영 체크리스트를 최종 갱신한다.
6. Vercel에 일찍 배포해 `after()`와 Cron을 확인하고 한 명 end-to-end 리허설을 한다.
7. 변경을 목적별 커밋으로 나눠 PR #10에 푸시한다.

## 상세 정본

- 우선순위·결정: [AGENTS.md](./AGENTS.md), [DECISIONS.md](./DECISIONS.md)
- 프론트/API 계약: [API_REFERENCE.md](./API_REFERENCE.md)
- 발행 파이프라인: [PIPELINE.md](./PIPELINE.md)
- DB: [apps/web/db/README.md](./apps/web/db/README.md), [schema.sql](./apps/web/db/schema.sql)
- 운영자 화면: [apps/web/app/admin/README.md](./apps/web/app/admin/README.md)
- 체인: [contracts/INTEGRATION_GUIDE.md](./contracts/INTEGRATION_GUIDE.md)
