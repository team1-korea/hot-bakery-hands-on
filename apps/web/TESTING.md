# 프론트엔드 검증 하네스

프론트 변경은 공개 경계에서 검증합니다. 내부 구현을 그대로 재현하는 테스트는 만들지 않습니다.

## 경계

- `tests/unit/`: 순수 로직과 동기 Client Component 동작
- `tests/e2e/`: 실제 Next.js 프로덕션 빌드에서 참가자·TV 공개 화면의 사용자 흐름
- `lib/server/*.test.ts`: 기존 API·저장소·파이프라인 검사

## 명령

```bash
cd apps/web

# 코드 작성 중 빠른 피드백
npm run verify:fast

# 단위 테스트 감시
npm run test:unit:watch

# 프로덕션 빌드 + 데스크톱/모바일 Chromium
npm run test:e2e

# 프론트 전체 검증
npm run verify:frontend

# 기존 서버 검사
npm test
```

E2E 명령은 실수로 실제 DB·Privy·Pinata·민팅 설정을 사용하는 일을 막기 위해 외부 환경변수를
빈 값으로 덮어쓰고, 브라우저에서 API 응답을 가로채 프론트 흐름만 검증합니다. 사용 중이지 않은
포트도 자동으로 골라 씁니다. 실패 시 `test-results/`에 스크린샷·비디오·트레이스를 남깁니다.

## 변경 작업 규칙

1. 사용자가 관찰하는 실패를 잡는 가장 작은 테스트를 먼저 추가합니다.
2. 테스트가 의도한 이유로 실패하는지 확인합니다.
3. 통과시키는 데 필요한 코드만 변경합니다.
4. `npm run verify:fast`를 반복하고, 완료 전에 관련 E2E와 `npm run verify:frontend`를 실행합니다.
