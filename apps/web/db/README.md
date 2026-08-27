# 데이터베이스

Supabase Postgres. 테이블 세 개가 전부입니다.

**실행 정본은 [`schema.sql`](./schema.sql)입니다.** 이 문서와 다르면 SQL이 맞습니다.
Supabase SQL Editor에 그 파일을 붙여 넣으면 끝이고, 마이그레이션 도구는 쓰지 않습니다.
**여러 번 돌려도 안전합니다** — 이미 있는 것은 건너뜁니다.

## 연결

`DATABASE_URL`에는 **Session pooler 주소**를 씁니다. 대시보드의 `Connect` → Session pooler.

```
postgresql://postgres.<ref>:<비밀번호>@aws-0-<리전>.pooler.supabase.com:5432/postgres
```

> ⚠️ **직접 연결(`db.<ref>.supabase.co`)을 쓰지 마세요.** 그 호스트는 **IPv6 전용**이라
> Vercel과 대부분의 로컬 네트워크에서 붙지 않습니다. 로컬에서 우연히 됐더라도 배포하면
> 터집니다.

> ⚠️ **비밀번호에 `$`가 있으면 `\$`로 이스케이프하세요.** Next가 dotenv 확장을 하므로
> `pass$word`의 `$word`가 빈 문자열로 치환됩니다. **따옴표로는 막히지 않습니다** —
> 큰따옴표·작은따옴표 모두 확장됩니다. 증상은 "비밀번호 인증 실패"라 원인을 찾기 어렵습니다.

**RLS를 켜세요.** 대시보드에서 스키마를 처음 돌릴 때 "without RLS"를 고르면 꺼진 채로
만들어집니다. `schema.sql`에 `enable row level security` 세 줄이 들어 있으니 다시 돌리면
켜집니다.

```
participants                    entries
─────────────                   ───────
id            ◄──────────────── participant_id  (unique = 한 사람당 한 장)
privy_did                       nickname
wallet_address                  status
created_at                      shelf_index
                                certificate_path
개인정보가 모이는 곳             certificate_cid
GET /api/state에                metadata_cid
절대 나가면 안 됨               token_id / tx_hash
                                hidden / failure_reason
                                created_at / status_changed_at

                                TV에 뜨는 카드 한 장
```

## 왜 테이블을 나눴나

정규화 때문이 아닙니다. **사고 방지입니다.**

`GET /api/state`는 인증이 없어 TV URL을 아는 사람이면 누구나 봅니다. DID와 지갑 주소가
`entries`에 있으면 `select *` 한 번으로 그대로 새어 나갑니다. 나눠 두면 state 쿼리가
`participants`를 조인하지 않는 한 샐 수가 없습니다.

---

## `show_state` — TV 화면 상태 (행 하나)

| 컬럼 | 타입 | 설명 |
|---|---|---|
| `id` | bool PK | **행 하나만** 존재하게 강제하는 장치. 항상 `true` |
| `layout` | `LIVE` \| `GALLERY` | LIVE는 작업대+오븐, GALLERY는 진열장만 크게 |
| `qr_visible` | bool | 참가 QR. 접수 중 켜고 발표 중 끕니다 |
| `shelf_page` | int | 지금 TV에 보이는 진열장 쪽(0부터). 사람이 넘깁니다 |
| `updated_at` | timestamptz | |

**메모리에 두면 안 됩니다.** 서버리스는 인보케이션마다 메모리가 달라서, 운영자가 GALLERY로
바꿔도 TV는 계속 LIVE를 봅니다. 서버가 들고 있어야 둘이 같은 것을 봅니다.

```sql
-- 운영자가 화면을 바꿀 때
update show_state set layout = 'GALLERY', updated_at = now();

-- GET /api/state가 읽을 때
select layout, qr_visible, shelf_page from show_state;
```

---

## `participants`

| 컬럼 | 타입 | 설명 |
|---|---|---|
| `id` | uuid | PK |
| `privy_did` | text **unique** | Privy DID. 서버가 토큰을 검증해서 얻습니다 |
| `wallet_address` | text **unique** | Privy 임베디드 EOA. **소문자로 정규화**해서 넣습니다 |
| `created_at` | timestamptz | 등록 시각 |

> ⚠️ `wallet_address`는 **서버가 Privy에 물어봐서** 채웁니다. 클라이언트가 보낸 주소를 그대로
> 넣으면 임의의 주소로 민팅시킬 수 있습니다.
>
> 소문자 강제는 `0xAbC...`와 `0xabc...`가 서로 다른 행으로 들어가 **같은 사람이 증서를 두 장**
> 받는 것을 막습니다. 컨트랙트의 `hasBeenIssued`가 결국 튕기겠지만, 그때는 이미 화면에 카드가
> 두 장입니다.

## `entries`

| 컬럼 | 타입 | 언제 채워지나 |
|---|---|---|
| `id` | uuid | 등록 |
| `participant_id` | uuid **unique** | 등록 |
| `nickname` | text (1~12자) | 등록 |
| `status` | `entry_status` | 단계마다 |
| `shelf_index` | int, **null 허용** | **사진 제출** |
| `certificate_path` | text | 사진 제출 (Supabase Storage 키) |
| `certificate_cid` | text | 증서 이미지 핀 |
| `metadata_cid` | text | 메타데이터 핀 |
| `tx_hash` | text | 민팅 트랜잭션 전송 |
| `token_id` | text | 영수증 확인 |
| `hidden` | bool | 운영자가 내릴 때, 또는 스위퍼가 자동으로 |
| `auto_hidden_at` | timestamptz | 자동 내림 또는 운영자가 표시를 고정한 시각 |
| `failure_reason` | text | 실패할 때 |
| `created_at` | timestamptz | 등록 |
| `status_changed_at` | timestamptz | 보통 상태 변경 때. `tx_hash` 보존 실패·재시도는 최초 전송 시각 유지 |

### 상태별로 뭐가 채워져 있나

```
JOINED ──→ SUBMITTED ──→ PINNED ──→ MINTING ──→ MINTED
   └───────────┴────────────┴──────────┴──────→ FAILED
```

| 컬럼 | JOINED | SUBMITTED | PINNED | MINTING | MINTED |
|---|:---:|:---:|:---:|:---:|:---:|
| `nickname` | ● | ● | ● | ● | ● |
| `certificate_path` | ○ | ● | ● | ● | ● |
| `shelf_index` | ○ | ● | ● | ● | ● |
| `certificate_cid` | ○ | ○ | ● | ● | ● |
| `metadata_cid` | ○ | ○ | ● | ● | ● |
| `tx_hash` | ○ | ○ | ○ | ● | ● |
| `token_id` | ○ | ○ | ○ | ○ | ● |

● 채워짐 · ○ null

**`FAILED`는 실패 직전까지 채워진 것을 그대로 둡니다.** 재시도할 때 되쓰기 위해서입니다 —
증서 이미지를 이미 핀했으면 `certificate_cid`가 남아 있어 다시 올릴 필요가 없습니다.
`shelf_index`도 유지되므로 재시도해도 진열장 자리가 바뀌지 않습니다.

`JOINED`에서 `FAILED`로는 갈 수 없습니다. 파이프라인이 `SUBMITTED`부터 시작하니
실패할 일이 없고, 아래 `photo_matches_status` 제약이 그것을 강제합니다.

### `hidden`과 `auto_hidden_at`

`hidden`은 **TV에서만** 감춥니다. **운영자 명단에서는 계속 보여야 합니다** — 나중에 그 참가자가
사진을 가져오면 다시 올려야 하기 때문입니다.

`auto_hidden_at`은 스위퍼가 운영자와 싸우지 않게 하는 마커입니다. `hidden=true`에서 값이
있으면 자동 내림, null이면 운영자 내림입니다. 자동으로 내려간 참가자가 사진을 제출하면
`attachPhoto`가 다시 표시하지만, 운영자가 직접 내린 행은 숨김을 유지합니다.

운영자가 카드를 내리면 `auto_hidden_at`을 null로 바꾸고, 다시 올리면 값을 남깁니다.
후자는 `hidden=false`인 카드를 스위퍼가 10분 뒤 또 내리지 않게 하는 표시 고정 마커입니다.

---

## 제약이 막는 것

| 제약 | 막는 상황 |
|---|---|
| `participants.privy_did` unique | 같은 사람이 두 번 등록 |
| `participants.wallet_address` unique + 소문자 | 대소문자만 다른 주소로 증서 두 장 |
| `entries.participant_id` unique | 한 사람이 카드 두 장 |
| `nickname` 1~12자 (공백 제거 후) | 빈 닉네임, 화면을 넘치는 긴 닉네임 |
| `shelf_index` unique | 두 카드가 같은 칸 |
| `shelf_index >= 0 and < 30` | **정원 초과.** 31번째가 여기서 튕깁니다 → `SHOWCASE_FULL` |
| `photo_matches_status` | `JOINED`인데 사진 있음 / 사진 없는데 `JOINED`가 아님 |
| `minted_is_complete` | 칸·토큰·트랜잭션 없이 진열장에 놓임 |
| `entry_status` enum | `RENDERED` 같은 없어진 상태값 |
| `show_state.id` bool PK | 화면 상태 행이 둘 이상 생기는 것 |
| `layout` in (LIVE, GALLERY) | 없는 레이아웃 값 |

전부 준비용 Supabase Postgres에서 실제로 막히는 것을 확인했습니다.

---

## `shelf_index` 배정

**사진 제출 트랜잭션 안에서** `next_shelf_index()`를 부릅니다.

```sql
update entries
   set status = 'SUBMITTED',
       certificate_path = $1,
       shelf_index = next_shelf_index(),
       status_changed_at = now()
 where id = $2 and shelf_index is null;
```

**등록 시점에 배정하지 않습니다.** 로그인만 하고 사라진 사람이 진열장 칸을 영구히 점유해
`Showcase.tsx`의 격자에 구멍이 남습니다. 그래서 null을 허용합니다.

**시퀀스를 쓰지 않습니다.** 시퀀스는 트랜잭션이 롤백돼도 번호를 되돌려주지 않아 빈 칸이
생깁니다 — 그게 바로 피하려는 것입니다. `next_shelf_index()`는 advisory lock으로 잡고
`max + 1`을 세므로 번호가 촘촘하게 유지됩니다. 12명 동시 제출로 `0..11` 연속, 구멍·중복
없음을 확인했습니다.

---

## 자주 쓸 쿼리

### TV 화면 (`GET /api/state`)

```sql
select id, nickname, status, shelf_index, hidden, created_at
  from entries
 order by shelf_index nulls last, created_at;
```

> ⚠️ **`participants`를 조인하지 마세요.** 그리고 `failure_reason`을 넣지 마세요.
> 인증 없는 공개 응답입니다.

### 민팅 대기열 집어가기

```sql
select pg_try_advisory_xact_lock(hashtext('hot-bakery-mint'));
```

민터 지갑이 하나라 동시에 트랜잭션을 보내면 nonce가 충돌합니다. 서버리스는 인보케이션이
여러 개 동시에 뜨므로 DB로 막습니다. 못 잡은 인보케이션은 트랜잭션을 끝내 커넥션을 반납한 뒤
400~1000ms 간격으로 다시 시도합니다. 최대 20초 안에 차례를 못 잡으면 `FAILED`로 내려 운영자가
재시도할 수 있게 합니다. 락을 기다리는 동안 DB 커넥션을 계속 점유하면 안 됩니다.

### 스위퍼 ① 멈춘 행 → `FAILED`

```sql
update entries
   set status = 'FAILED',
       failure_reason = '처리 중 멈춤 (스위퍼)',
       status_changed_at = now()
 where status in ('SUBMITTED', 'PINNED')
   and status_changed_at < now() - interval '90 seconds';
```

`after()`는 재시도를 해주지 않습니다. 인보케이션이 죽으면 행이 중간 상태로 남고, 그대로 두면
영원히 오븐에 있는 카드가 생깁니다.

`MINTING`은 이 SQL로 내리지 않습니다. `/api/internal/sweep`가 영수증과 `CertificateIssued`
이벤트를 먼저 조회해 성공을 복구합니다. 영수증이 없으면 트랜잭션 전송 후 5분을 기다린 뒤 공개 RPC에서
세 번 연속 트랜잭션을 찾지 못한 경우에만 해시를 비우고 실패 처리합니다. 복구 절차는
[PIPELINE.md](../../../PIPELINE.md)에 있습니다.

### 스위퍼 ② 방치된 `JOINED` → `hidden`

```sql
update entries set hidden = true, auto_hidden_at = now()
 where status = 'JOINED' and hidden = false
   and auto_hidden_at is null                    -- 이미 한 번 내린 건 다시 안 건드린다
   and status_changed_at < now() - interval '10 minutes';
```

로그인만 하고 사라진 사람의 카드가 행사 내내 작업대에 남습니다. **되돌릴 수 있어야 합니다** —
자동으로 내려간 참가자가 늦게 사진을 내면 제출 트랜잭션이 `hidden`을 false로 바꿉니다.
운영자가 직접 숨긴 카드는 `auto_hidden_at`이 null이므로 자동으로 올리지 않습니다.

### Supabase Cron 연결

Vercel Hobby Cron은 1분 주기로 실행할 수 없으므로 Supabase의 `pg_cron`과 `pg_net`이 배포된
`POST /api/internal/sweep`를 1분마다 호출합니다. 앱 코드와 스케줄러는 같은 `CRON_SECRET`으로
인증하고, 값은 저장소가 아니라 Supabase Vault에 보관합니다.

1. Vercel Production 환경에 충분히 긴 임의의 `CRON_SECRET`을 설정합니다.
2. Supabase Dashboard의 SQL Editor에서 아래 두 값을 한 번 저장합니다. 두 번째 값은 Vercel에
   넣은 것과 정확히 같아야 합니다.

```sql
select vault.create_secret(
  'https://avalanche-bakery.vercel.app',
  'hot_bakery_app_url'
);
select vault.create_secret(
  '<Vercel Production의 CRON_SECRET>',
  'hot_bakery_cron_secret'
);
```

3. 같은 SQL Editor에서 [`cron.sql`](./cron.sql)을 실행합니다. 이 파일은 기존
   `hot-bakery-sweep` 작업을 먼저 내리므로 다시 실행해도 작업이 중복되지 않습니다.
4. 1분 뒤 실행 이력을 확인합니다. `status`가 `succeeded`여야 합니다.

```sql
select jobid, jobname, schedule, active
  from cron.job
 where jobname = 'hot-bakery-sweep';

select status, return_message, start_time, end_time
  from cron.job_run_details
 where jobid = (select jobid from cron.job where jobname = 'hot-bakery-sweep')
 order by start_time desc
 limit 10;
```

Cron 성공은 HTTP 요청을 예약했다는 뜻입니다. Vercel 로그에서 `/api/internal/sweep`가 200으로
응답하는 것도 확인하세요. 401이면 두 곳의 `CRON_SECRET`이 다른 것입니다.

### 운영자 — 아직 안 낸 사람

```sql
select nickname, created_at from entries
 where status = 'JOINED'
 order by created_at;
```

### 운영자 — 아직 증서를 못 받은 사람 전부

행사 끝 무렵 점검용입니다. **참가자에게 알릴 수단이 우리에게 없으므로**(Privy가 이메일을
갖고 있습니다) 운영자가 직접 불러서 알려줘야 합니다.

```sql
select nickname, status, failure_reason from entries
 where status <> 'MINTED'
 order by created_at;
```

`hidden`으로 거르지 마세요. TV에서 내렸어도 증서는 줘야 합니다.

### 운영자 화면 (`GET /api/admin/state`)

```sql
select e.*, p.wallet_address
  from entries e
  join participants p on p.id = e.participant_id
 order by e.created_at;
```

**인증된 운영자 전용입니다.** `failure_reason`과 지갑 주소가 들어가므로 공개
`GET /api/state`와 반드시 다른 엔드포인트여야 합니다.

---

## API 필드 ↔ 컬럼

`Entry`는 camelCase, DB는 snake_case입니다. 그대로 매핑되지 않는 것만 표시했습니다.

| `Entry` 필드 | 컬럼 |
|---|---|
| `id` `nickname` `status` `hidden` | 같은 이름 |
| `shelfIndex` `tokenId` `txHash` `failureReason` | snake_case 변환 |
| **`photoUrl`** | `certificate_path`로 **URL을 만들어** 넣습니다 |
| **`submittedAt`** | **`created_at`** (등록 시각) |

운영자 응답의 `nicknameEditable`은 컬럼이 아니라 `metadata_cid is null`로 계산합니다.
`capabilities.resetDatabase`와 `capabilities.mockServer`도 서버 실행 모드에서 계산하며 DB에 저장하지 않습니다.

### 절대 API로 나가지 않는 것

| 컬럼 | 이유 |
|---|---|
| `participants.privy_did` | 개인정보 |
| `participants.wallet_address` | 개인정보 |
| `certificate_cid` `metadata_cid` | 서버 내부용. 필요하면 체인의 `tokenURI`로 조회 |
| `status_changed_at` `auto_hidden_at` | 스위퍼 전용 |
| `failure_reason` | **운영자 전용.** 공개 `GET /api/state`에 절대 넣지 마세요. 운영자 화면은 `GET /api/admin/state`로 받습니다 |

---

## 테스트 데이터 초기화

- [`reset.sql`](./reset.sql)은 DB의 `participants`·`entries`만 비우고 `show_state`를 초기값으로
  되돌립니다. **Supabase Storage 객체는 지우지 않습니다.** SQL Editor에서 수동으로 쓸 때는
  버킷도 별도로 비우세요.
- 운영자 `POST /api/admin/reset`은 `ALLOW_DB_RESET=1`일 때만 열리며 DB 초기화와 Storage 객체
  삭제를 함께 수행하고 `{ deleted: { participants, entries } }`를 반환합니다.
- 어느 경로도 IPFS 핀이나 온체인 발행을 되돌리지 못합니다. 테스트 민팅은 매번 새 주소를 씁니다.

운영 Vercel에는 `ALLOW_DB_RESET`을 넣지 않습니다. 그러면 운영자 응답의
`capabilities.resetDatabase`도 `false`이고 엔드포인트 직접 호출도 `404`입니다.

---

## 관련 문서

| 찾는 것 | 문서 |
|---|---|
| 엔드포인트, 요청·응답 | [API_REFERENCE.md](../../../API_REFERENCE.md) |
| 상태 전이, 민팅 순서, 실패 복구 | [PIPELINE.md](../../../PIPELINE.md) |
| 결정과 근거 | [DECISIONS.md](../../../DECISIONS.md) |
