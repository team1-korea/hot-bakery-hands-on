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

`apps/demo/`는 참가자 화면과 행사장 TV의 흐름을 확정하기 위해 만든 프로토타입입니다. 모든 상태가
목업이며 더 이상 고치지 않습니다.

## Documentation

**[AGENTS.md](./AGENTS.md)부터 읽으세요.** 문서 우선순위, 담당 경계, 이미 확정돼 다시 정하지
않는 것들이 있습니다.

작업을 이어받는 에이전트는 현재 상태만 요약한 [HANDOFF.md](./HANDOFF.md)를 먼저 보고 아래 정본으로
내려가세요.

| 하려는 일 | 문서 |
|---|---|
| 참가자·TV 화면을 붙인다 | [API_REFERENCE.md](./API_REFERENCE.md) — 「프론트가 부르는 것」부터 「오류 형식」까지. 운영자 API 앞에서 멈추면 됩니다 |
| 백엔드를 구현한다 | [PIPELINE.md](./PIPELINE.md) 제출부터 민팅까지 · [API_REFERENCE.md](./API_REFERENCE.md) 전부 |
| 테이블을 만지거나 쿼리를 쓴다 | [apps/web/db/README.md](./apps/web/db/README.md) — 스키마 정본은 옆의 `schema.sql` |
| 운영자 화면을 운영·수정한다 | [apps/web/app/admin/README.md](./apps/web/app/admin/README.md) — 구현된 복구 기능과 행사 당일 시나리오 |
| 컨트랙트를 호출한다 | [contracts/INTEGRATION_GUIDE.md](./contracts/INTEGRATION_GUIDE.md) |
| 왜 이렇게 정했는지 알고 싶다 | [DECISIONS.md](./DECISIONS.md) |
| 역할 경계와 남은 위험을 본다 | [ARCHITECTURE.md](./ARCHITECTURE.md) |
| 앱을 실행한다 | [apps/web/README.md](./apps/web/README.md) |

> `ARCHITECTURE.md`는 `API.md`였습니다. 이름이 엔드포인트 문서처럼 읽혀
> [API_REFERENCE.md](./API_REFERENCE.md)와 헷갈렸습니다. **엔드포인트 명세는
> `API_REFERENCE.md` 하나뿐입니다.**

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
