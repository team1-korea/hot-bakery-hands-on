# Hot Bakery Hands-on

Avalanche Bakery 행사에서 사용하는 소프트웨어 모노레포입니다.

## Repository layout

```text
hot-bakery-hands-on/
├── contracts/   # Avalanche 참가증서 컨트랙트와 Foundry 테스트
├── apps/demo/   # 화면 흐름 검토용 Next.js 프로토타입
└── apps/web/    # 행사에서 실제로 쓰는 Next.js 서비스
```

Next.js 서비스는 루트가 아니라 `apps/web/`에 두어 컨트랙트 패키지와 배포 주기를 분리합니다.

- 시스템 API 계약: [API.md](./API.md) — 프론트·백엔드·컨트랙트 담당자가 함께 보는 문서
- 화면 설명과 실행 방법: [apps/web/README.md](./apps/web/README.md)

`apps/demo/`는 참가자 화면과 행사장 TV의 흐름을 확정하기 위해 만든 프로토타입입니다. 모든 상태가
목업이며 더 이상 고치지 않습니다.

## Smart contract

- 컨트랙트 개요와 로컬 실행: [contracts/README.md](./contracts/README.md)
- 프론트엔드·백엔드 연동: [contracts/INTEGRATION_GUIDE.md](./contracts/INTEGRATION_GUIDE.md)
- 공용 ABI: [contracts/abi/AvalancheBakeryCertificate.json](./contracts/abi/AvalancheBakeryCertificate.json)
- Fuji 배포 정보: [contracts/deployments/43113.json](./contracts/deployments/43113.json)
- Fuji 테스트넷 검증: [contracts/FUJI_SMOKE_TEST.md](./contracts/FUJI_SMOKE_TEST.md)

Fuji 테스트 컨트랙트:

```text
0x67Ce0bb25ee58B6D000d209B051b9E846D0d6b36
```

## Contribution

초기 커밋 이후 작업은 기능 브랜치에서 진행하고 pull request로 병합합니다. 비밀키, `.env`, keystore,
Foundry 빌드 결과와 로컬 에이전트 문서는 커밋하지 않습니다.
