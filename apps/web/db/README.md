# 데이터베이스

Supabase Postgres. 테이블 두 개가 전부입니다.

**실행 정본은 [`schema.sql`](./schema.sql)입니다.** 이 문서와 다르면 SQL이 맞습니다.
Supabase SQL Editor에 그 파일을 붙여 넣으면 끝이고, 마이그레이션 도구는 쓰지 않습니다.

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
| `hidden` | bool | 운영자가 내릴 때 |
| `failure_reason` | text | 실패할 때 |
| `created_at` | timestamptz | 등록 |
| `status_changed_at` | timestamptz | **상태를 바꿀 때마다** |

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

전부 Postgres 16에서 실제로 막히는 것을 확인했습니다.

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
select * from entries
 where status = 'PINNED'
 order by shelf_index
   for update skip locked
 limit 1;
```

민터 지갑이 하나라 동시에 트랜잭션을 보내면 nonce가 충돌합니다. 서버리스는 인보케이션이
여러 개 동시에 뜨므로 DB로 막습니다. **못 잡은 인보케이션은 그냥 끝내면 됩니다** — 남은 일은
다음 제출이나 스위퍼가 주워갑니다.

### 스위퍼 ① 멈춘 행 → `FAILED`

```sql
update entries
   set status = 'FAILED',
       failure_reason = '처리 중 멈춤 (스위퍼)',
       status_changed_at = now()
 where status in ('SUBMITTED', 'PINNED', 'MINTING')
   and status_changed_at < now() - interval '5 minutes';
```

`after()`는 재시도를 해주지 않습니다. 인보케이션이 죽으면 행이 중간 상태로 남고, 그대로 두면
영원히 오븐에 있는 카드가 생깁니다.

> ⚠️ **`MINTING`을 내리기 전에 `CertificateIssued` 이벤트를 먼저 확인하세요.** 트랜잭션은
> 성공했는데 DB 갱신 전에 함수가 죽었을 수 있습니다. 그걸 `FAILED`로 내리면 **이미 발행된
> 증서를 잃어버립니다.** 복구 절차는 [PIPELINE.md](../../../PIPELINE.md)에 있습니다.

### 스위퍼 ② 방치된 `JOINED` → `hidden`

```sql
update entries set hidden = true
 where status = 'JOINED' and hidden = false
   and status_changed_at < now() - interval '10 minutes';
```

로그인만 하고 사라진 사람의 카드가 행사 내내 작업대에 남습니다. **되돌릴 수 있어야 합니다** —
늦게 온 참가자가 사진을 내면 `hidden`을 false로 풉니다.

### 운영자 — 아직 안 낸 사람

```sql
select nickname, created_at from entries
 where status = 'JOINED' and hidden = false
 order by created_at;
```

---

## API 필드 ↔ 컬럼

`Entry`는 camelCase, DB는 snake_case입니다. 그대로 매핑되지 않는 것만 표시했습니다.

| `Entry` 필드 | 컬럼 |
|---|---|
| `id` `nickname` `status` `hidden` | 같은 이름 |
| `shelfIndex` `tokenId` `txHash` `failureReason` | snake_case 변환 |
| **`photoUrl`** | `certificate_path`로 **URL을 만들어** 넣습니다 |
| **`certificateUrl`** | **없습니다. 항상 `null`.** 제거 대상 |
| **`submittedAt`** | **`created_at`** (등록 시각) |

### 절대 API로 나가지 않는 것

| 컬럼 | 이유 |
|---|---|
| `participants.privy_did` | 개인정보 |
| `participants.wallet_address` | 개인정보 |
| `certificate_cid` `metadata_cid` | 서버 내부용. 필요하면 체인의 `tokenURI`로 조회 |
| `status_changed_at` | 스위퍼 전용 |
| `failure_reason` | **운영자 전용.** `GET /api/state`에 절대 넣지 마세요 |

---

## 관련 문서

| 찾는 것 | 문서 |
|---|---|
| 엔드포인트, 요청·응답 | [API_REFERENCE.md](../../../API_REFERENCE.md) |
| 상태 전이, 민팅 순서, 실패 복구 | [PIPELINE.md](../../../PIPELINE.md) |
| 결정과 근거 | [DECISIONS.md](../../../DECISIONS.md) |
