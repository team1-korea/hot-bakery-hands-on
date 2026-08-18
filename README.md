# Hot Bakery Hands-on

Avalanche Bakery 행사에서 사용하는 소프트웨어 모노레포입니다.

## Repository layout

```text
hot-bakery-hands-on/
├── contracts/   # Avalanche 참가증서 컨트랙트와 Foundry 테스트
└── apps/web/    # Next.js 서비스 예정 위치
```

현재는 스마트 컨트랙트 패키지만 구현되어 있습니다. Next.js 서비스는 루트가 아니라 `apps/web/`에 추가해
컨트랙트 패키지와 배포 주기를 분리합니다.

## Smart contract

- 컨트랙트 개요와 로컬 실행: [contracts/README.md](./contracts/README.md)
- 프론트엔드·백엔드 연동: [contracts/INTEGRATION_GUIDE.md](./contracts/INTEGRATION_GUIDE.md)
- Fuji 테스트넷 검증: [contracts/FUJI_SMOKE_TEST.md](./contracts/FUJI_SMOKE_TEST.md)

Fuji 테스트 컨트랙트:

```text
0x67Ce0bb25ee58B6D000d209B051b9E846D0d6b36
```

## Contribution

초기 커밋 이후 작업은 기능 브랜치에서 진행하고 pull request로 병합합니다. 비밀키, `.env`, keystore,
Foundry 빌드 결과와 로컬 에이전트 문서는 커밋하지 않습니다.
