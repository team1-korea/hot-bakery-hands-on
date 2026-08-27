# Avalanche Bakery — 서비스 프론트엔드

쿠키 클래스 현장에서 실제로 쓰는 화면입니다. 참가자는 휴대폰으로 닉네임과 증서 이미지를 보내고, 굽고 진열되는
과정은 행사장 TV가 보여줍니다.

## 화면

| 경로 | 쓰는 사람 | 하는 일 |
|---|---|---|
| `/join` | 참가자 휴대폰 | Google 로그인 → 닉네임 등록 → 사진·프레임 합성 → 제출 |
| `/display` | 행사장 TV | 접수·오븐·진열장. 참가 QR을 함께 띄운다 |
| `/admin` | 운영 노트북 | 명단·실패 확인, 닉네임 수정, 대리 업로드, 재시도, TV 제어 |

`/`는 `/join`으로 보냅니다. QR은 사이트 루트를 가리킵니다.

## 채택한 안

제출을 마친 휴대폰은 처리 과정을 설명하지 않습니다. "고개를 들어 앞 화면을 보세요"만 남기고, 발행이
끝나면 결과 한 장을 보여줍니다. 굽는 과정은 TV가 맡습니다.

## 실행

```bash
npm install
npm run dev
```

### 휴대폰으로 확인할 때

`localhost`는 그 기기 자신을 뜻하므로 휴대폰에서는 열리지 않습니다. 같은 와이파이에서 이 컴퓨터의 주소로
엽니다.

`/display`의 QR은 **그 페이지를 열 때 쓴 주소를 그대로 인코딩합니다.** `localhost:3000/display`로 TV를
열면 QR이 `localhost:3000/join`을 가리켜 휴대폰에서 열리지 않습니다. `http://<이 컴퓨터의 IP>:3000/display`로
열어야 QR도 같은 주소를 가리킵니다.

배포한 뒤에는 신경 쓸 것이 없습니다. 호스트가 배포 도메인이므로 QR도 알아서 그 주소를 가리킵니다.
다른 도메인을 가리켜야 할 때만 `NEXT_PUBLIC_SITE_URL`을 지정합니다.

## 서버

화면과 API는 같은 Next.js 앱입니다. `DATABASE_URL`이 없으면 재시작 시 사라지는 메모리 목,
있으면 Supabase Postgres·Storage와 Pinata·설정된 Avalanche C-Chain 파이프라인을 씁니다. 프론트 담당자는 외부 서비스나
Postgres를 설치하지 않고 환경변수를 비운 채 개발합니다. 참가자 API 계약은
[../../API_REFERENCE.md](../../API_REFERENCE.md)에서 `프론트는 여기까지` 구간만 보면 됩니다.

## 확인

```bash
npx tsc --noEmit
npm test
npm run build
npm run lint
```

`DATABASE_URL`이 있으면 테스트가 실제 준비 DB를 사용할 수 있으므로 행사 데이터가 있는 환경에서는
`npm test`를 실행하지 마세요.

## 배포·행사 전 확인

- Vercel Root Directory는 `apps/web`; 운영 필수 환경변수는 [API_REFERENCE.md](../../API_REFERENCE.md)에 맞춘다.
- `NEXT_PUBLIC_CERTIFICATE_FRAME_URL`은 Git에 넣지 않은 확정 디자인의 CORS 허용 URL로 설정한다.
- Privy에서 Google 로그인, embedded EVM wallet, 배포 오리진을 설정한다.
- Supabase 스키마·RLS·공개 `certificates` 버킷을 확인하고 프로젝트를 깨워 둔다.
- Supabase Cron이 `Authorization: Bearer <CRON_SECRET>`으로 `/api/internal/sweep`를 1분마다
  부르게 한다. 설정은 [db/README.md](./db/README.md)를 따른다.
- 참가자와 운영자 대리 업로드가 같은 최종 프레임 합성을 쓰는지 확인한다.
- `ALLOW_DB_RESET`은 운영에서 빼고 `OPERATOR_PASSCODE`는 길게 설정한다.
- 리허설 데이터를 DB·Storage에서 지운 뒤 실제 Google 로그인 한 명을 끝까지 발행해 본다.
- TV 브라우저는 `/admin`에 먼저 로그인한 뒤 `/display`를 연다.

## Fuji ↔ 메인넷 전환

명령은 기본적으로 dry-run이며 Vercel 값을 바꾸지 않습니다. 메인넷 컨트랙트를 배포한 직후 주소와
블록을 한 번 사전 등록합니다. 이때 활성 체인은 바뀌지 않아 Production은 Fuji로 계속 동작합니다.
실제 반영에는 Vercel CLI 로그인과 저장소 루트의 기존 프로젝트 연결이 필요합니다.

```bash
# 메인넷 컨트랙트 배포 직후 한 번
npm run chain:prepare-mainnet -- --address 0x... --block 12345678
npm run chain:prepare-mainnet -- --address 0x... --block 12345678 --apply --confirm PREPARE

# 행사 전환과 테스트넷 복귀
npm run chain:switch -- mainnet
npm run chain:switch -- mainnet --apply --confirm 43114
npm run chain:switch -- fuji
npm run chain:switch -- fuji --apply --confirm 43113
```

Fuji는 Vercel에 메인넷 주소와 블록이 미리 등록돼 있어도 무시합니다. 사전 준비 뒤에는 재배포할
필요가 없습니다. 체인 전환 명령 뒤에는 최신 `main`을 Production으로 재배포합니다. 전환 전에 이전
체인의 DB·Storage 테스트 데이터를 비워야 기존 트랜잭션 링크가 새 체인의 Explorer로 잘못 열리지
않습니다.
