-- Avalanche Bakery — Supabase Postgres 스키마
--
-- Supabase SQL Editor에 그대로 붙여 넣으면 됩니다. 마이그레이션 도구는 쓰지 않습니다.
-- 행사 한 번짜리라 파일 하나로 충분합니다.
--
-- 계약 정본: apps/web/lib/api/types.ts · API_REFERENCE.md
-- 파이프라인: PIPELINE.md

-- ---------------------------------------------------------------------------
-- participants — 개인정보가 모이는 테이블
-- ---------------------------------------------------------------------------
-- entries와 나눠 둔 이유는 정규화가 아니라 **사고 방지**입니다.
-- GET /api/state는 인증이 없어 TV URL을 아는 사람이면 누구나 봅니다. DID와 지갑
-- 주소가 entries에 있으면 `select *` 한 번으로 그대로 새어 나갑니다. 테이블을
-- 나눠 두면 state 쿼리가 이 테이블을 조인하지 않는 한 샐 수가 없습니다.

create table if not exists participants (
  id             uuid primary key default gen_random_uuid(),

  -- Privy DID. 서버가 토큰을 검증해서 얻습니다.
  privy_did      text not null unique,

  -- Privy 임베디드 EOA. **서버가 Privy에 물어봐서 채웁니다.**
  -- 클라이언트가 보낸 주소를 그대로 넣으면 임의의 주소로 민팅시킬 수 있습니다.
  -- 대소문자 혼용 주소가 중복으로 들어가지 않게 소문자로 정규화해서 넣으세요.
  wallet_address text not null unique check (wallet_address = lower(wallet_address)),

  created_at     timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- entries — TV에 뜨는 카드 한 장
-- ---------------------------------------------------------------------------

do $$ begin
  create type entry_status as enum (
    'JOINED',     -- 로그인·닉네임 등록 완료. 사진 없음        → 작업대
    'SUBMITTED',  -- 합성 증서를 받음                        → 오븐
    'PINNED',     -- 증서와 메타데이터 IPFS 핀 완료           → 오븐
    'MINTING',    -- 민팅 트랜잭션 전송, 영수증 대기          → 오븐
    'MINTED',     -- 영수증 성공 + CertificateIssued 확인     → 진열장
    'FAILED'      -- 어느 단계든 실패                        → 작업대
  );
exception when duplicate_object then null;
end $$;

create table if not exists entries (
  id              uuid primary key default gen_random_uuid(),

  -- 한 사람당 한 장. 컨트랙트도 hasBeenIssued로 주소당 한 장을 강제합니다.
  participant_id  uuid not null unique references participants(id) on delete cascade,

  nickname        text not null check (length(btrim(nickname)) between 1 and 12),
  status          entry_status not null default 'JOINED',

  -- 진열장 칸 번호. **사진 제출 때 배정하고 이후 바꾸지 않습니다.**
  -- 등록 때 배정하면 로그인만 하고 사라진 사람이 칸을 영구히 점유해
  -- Showcase 격자에 구멍이 남습니다. 그래서 null을 허용합니다.
  -- 30칸 제약이 정원 제한을 겸합니다 — 31번째는 여기서 튕기고,
  -- 그것을 SHOWCASE_FULL(409)로 변환합니다.
  shelf_index     integer unique check (shelf_index >= 0 and shelf_index < 30),

  -- Supabase Storage 키. 프론트가 프레임까지 합성해서 보낸 이미지입니다.
  -- **원본 사진은 서버로 오지 않습니다.** 저장되는 이미지는 이것 하나뿐입니다.
  certificate_path text,

  certificate_cid text,   -- 증서 이미지 핀 결과
  metadata_cid    text,   -- 메타데이터 JSON 핀 결과. mint의 인자가 됩니다

  -- uint256이라 문자열로 둡니다. bigint로 받으면 JSON 직렬화에서 깨집니다.
  token_id        text,
  tx_hash         text,

  hidden          boolean not null default false,

  -- 스위퍼가 자동으로 내린 시각. 운영자가 내린 것과 구분합니다.
  -- 스위퍼는 이 값이 null인 행만 건드리고, 한 번 내린 뒤에는 다시 손대지 않습니다.
  -- 그래야 늦게 온 참가자를 운영자가 다시 올렸을 때 스위퍼가 또 내리지 않습니다.
  auto_hidden_at  timestamptz,

  -- **운영자 전용입니다.** GET /api/state에 절대 넣지 마세요.
  failure_reason  text,

  -- 등록 시각. API의 submittedAt이 이 값입니다(카드 정렬 기준).
  created_at      timestamptz not null default now(),

  -- 스위퍼가 "얼마나 오래 이 상태였나"를 보는 값입니다. 상태를 바꿀 때마다 같이 갱신하세요.
  status_changed_at timestamptz not null default now(),

  -- 사진이 없으면 JOINED, 있으면 JOINED가 아니어야 합니다.
  constraint photo_matches_status check (
    (status = 'JOINED') = (certificate_path is null)
  ),

  -- 진열장에 놓이려면 칸과 토큰이 있어야 합니다.
  constraint minted_is_complete check (
    status <> 'MINTED' or (shelf_index is not null and token_id is not null and tx_hash is not null)
  )
);

-- 민팅 대기열을 집어갈 때(PINNED)와 스위퍼가 훑을 때 씁니다.
create index if not exists entries_status_shelf_idx on entries (status, shelf_index);

-- ---------------------------------------------------------------------------
-- show_state — TV 화면 상태 (행 하나)
-- ---------------------------------------------------------------------------
-- 운영자가 바꾸고 TV가 따라갑니다. **서버가 들고 있어야 합니다.**
-- 서버리스는 인보케이션마다 메모리가 다르므로, 프로세스 안에 두면 운영자가
-- GALLERY로 바꿔도 TV는 계속 LIVE를 봅니다.

create table if not exists show_state (
  -- 행이 하나뿐이어야 합니다. true만 허용되는 PK로 강제합니다.
  id          boolean primary key default true check (id),

  -- LIVE는 작업대와 오븐을 함께, GALLERY는 진열장만 크게 보여줍니다.
  layout      text not null default 'LIVE' check (layout in ('LIVE', 'GALLERY')),

  -- 참가 QR. 접수 중에는 켜고 발표 중에는 끕니다.
  qr_visible  boolean not null default true,

  -- 지금 TV에 보이는 진열장 쪽(0부터). 저절로 넘어가지 않고 사람이 넘깁니다.
  shelf_page  integer not null default 0 check (shelf_page >= 0),

  updated_at  timestamptz not null default now()
);

insert into show_state (id) values (true) on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------
-- **정책을 하나도 만들지 않는다.** RLS를 켜고 정책이 없으면 전면 차단이고, 그것이 우리가
-- 원하는 상태다.
--
-- 브라우저는 Supabase에 직접 붙지 않는다. Next.js 서버가 DATABASE_URL로 붙고, 그 연결은
-- 테이블 소유자라 RLS를 우회한다(FORCE ROW LEVEL SECURITY를 걸지 않는 한). 그래서 켜도
-- 우리 코드는 그대로 돌고, anon/authenticated 키를 쥔 외부인만 막힌다.
--
-- 끄면 anon 키가 어디로든 새는 순간 participants의 지갑 주소와 Privy DID가 그대로 읽힌다.

alter table participants enable row level security;
alter table entries     enable row level security;
alter table show_state  enable row level security;

-- ---------------------------------------------------------------------------
-- shelf_index 배정
-- ---------------------------------------------------------------------------
-- 사진 제출 트랜잭션 안에서 부르세요.
--
-- 시퀀스를 쓰지 않는 이유: 트랜잭션이 롤백되면 시퀀스는 번호를 되돌려주지 않아
-- 진열장에 빈 칸이 생깁니다. 그게 바로 우리가 피하려는 것입니다.
-- advisory lock으로 잡으면 번호가 촘촘하게 유지됩니다. 14명 규모에서 경합은 없습니다.

create or replace function next_shelf_index() returns integer as $$
declare
  next_index integer;
begin
  perform pg_advisory_xact_lock(hashtext('shelf_index'));
  select coalesce(max(shelf_index) + 1, 0) into next_index from entries;
  return next_index;   -- 30 이상이면 check 제약이 튕깁니다 → SHOWCASE_FULL
end;
$$ language plpgsql;

-- ---------------------------------------------------------------------------
-- 민팅 직렬화
-- ---------------------------------------------------------------------------
-- 민터 지갑이 하나라 동시에 트랜잭션을 보내면 nonce가 충돌합니다. 서버리스는
-- 인보케이션이 여러 개 동시에 뜨므로 DB로 막습니다.
--
--   select * from entries
--   where status = 'PINNED'
--   order by shelf_index
--   for update skip locked
--   limit 1;
--
-- 못 잡은 인보케이션은 그냥 끝내면 됩니다. 남은 일은 다음 제출이나 스위퍼가 주워갑니다.

-- ---------------------------------------------------------------------------
-- 스위퍼 (pg_cron이 1분마다 API 라우트를 호출 → 라우트가 아래를 실행)
-- ---------------------------------------------------------------------------
-- 로직을 cron에 넣지 마세요. 함수로 두면 로컬에서 그냥 호출해 테스트할 수 있고,
-- 스케줄러를 Vercel Cron으로 갈아타도 그대로 씁니다.

-- ① 중간 상태로 멈춘 행 → FAILED
--    after()는 재시도를 해주지 않습니다. 인보케이션이 죽으면 행이 중간 상태로 남고,
--    그대로 두면 영원히 오븐에 있는 카드가 생깁니다.
--
--   update entries set status = 'FAILED', failure_reason = '처리 중 멈춤 (스위퍼)',
--          status_changed_at = now()
--   where status in ('SUBMITTED', 'PINNED', 'MINTING')
--     and status_changed_at < now() - interval '5 minutes';
--
--   ⚠️ MINTING을 내리기 전에 CertificateIssued 이벤트를 먼저 확인하세요.
--      트랜잭션은 성공했는데 DB 갱신 전에 죽었을 수 있습니다. 그걸 FAILED로
--      내리면 이미 발행된 증서를 잃어버립니다. PIPELINE.md의 복구 절차를 보세요.

-- ② 오래 방치된 JOINED → hidden
--    로그인만 하고 사라진 사람의 카드가 행사 내내 작업대에 남습니다.
--
--   update entries set hidden = true, auto_hidden_at = now()
--   where status = 'JOINED' and hidden = false
--     and auto_hidden_at is null                        -- 이미 한 번 내린 건 다시 안 건드린다
--     and status_changed_at < now() - interval '10 minutes';
--
--   되돌릴 수 있어야 합니다. 늦게 온 참가자가 사진을 내면 운영자가 hidden을 false로 풉니다.
--   auto_hidden_at은 그대로 두세요. 그래야 스위퍼가 또 내리지 않습니다.
--
--   ⚠️ hidden은 **TV에서만** 감춥니다. 운영자 명단에서는 계속 보여야 합니다.
--      나중에 그 참가자가 사진을 가져오면 다시 올려야 하기 때문입니다.
