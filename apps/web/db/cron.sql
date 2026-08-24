-- Avalanche Bakery — Supabase Cron 설정
--
-- 먼저 Supabase Vault에 아래 이름으로 값을 넣으세요.
--   hot_bakery_app_url     = https://avalanche-bakery.vercel.app
--   hot_bakery_cron_secret = Vercel Production의 CRON_SECRET과 같은 값
--
-- 비밀값은 이 파일에 직접 쓰지 않습니다. 설정 방법과 확인 쿼리는 README.md에 있습니다.

create extension if not exists pg_cron;
create extension if not exists pg_net with schema extensions;

do $$
begin
  if not exists (
    select 1 from vault.decrypted_secrets where name = 'hot_bakery_app_url'
  ) then
    raise exception 'Vault secret hot_bakery_app_url is missing';
  end if;

  if not exists (
    select 1 from vault.decrypted_secrets where name = 'hot_bakery_cron_secret'
  ) then
    raise exception 'Vault secret hot_bakery_cron_secret is missing';
  end if;
end
$$;

-- 다시 실행해도 같은 이름의 작업이 중복되지 않는다.
select cron.unschedule(jobid)
  from cron.job
 where jobname = 'hot-bakery-sweep';

select cron.schedule(
  'hot-bakery-sweep',
  '* * * * *',
  $job$
    select net.http_post(
      url := (
        select decrypted_secret
          from vault.decrypted_secrets
         where name = 'hot_bakery_app_url'
      ) || '/api/internal/sweep',
      headers := jsonb_build_object(
        'Authorization', 'Bearer ' || (
          select decrypted_secret
            from vault.decrypted_secrets
           where name = 'hot_bakery_cron_secret'
        ),
        'Content-Type', 'application/json'
      ),
      body := '{}'::jsonb,
      timeout_milliseconds := 55000
    ) as request_id;
  $job$
);
