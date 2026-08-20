import { Pool, type PoolClient, type QueryResult, type QueryResultRow } from 'pg';

/**
 * Supabase Postgres 연결. 스키마 정본은 `db/schema.sql`이고 여기서는 붙기만 한다.
 *
 * **import 시점에는 아무 일도 하지 않는다.** 프론트 담당자는 `DATABASE_URL` 없이
 * 개발하고, 그때도 앱이 떠야 한다(AGENTS.md「없으면 목, 있으면 실제」). 풀은 첫 쿼리에서
 * 만든다 — `chain.ts`가 민터 키를 쓰기 직전까지 요구하지 않는 것과 같은 이유다.
 */

let pool: Pool | null = null;

function getPool(): Pool {
  if (pool) return pool;

  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('DATABASE_URL이 없다. 이 경로는 store.ts가 메모리 구현으로 보냈어야 한다.');
  }

  pool = new Pool({
    connectionString,
    /**
     * 서버리스 + 세션 풀러다. 인보케이션마다 풀이 새로 생기므로 하나가 크면 풀러 쪽
     * 연결 한도를 인보케이션 몇 개로 다 먹는다. 참가자 30명에 3이면 충분하다.
     */
    max: 3,
    idleTimeoutMillis: 10_000,
    connectionTimeoutMillis: 10_000,
    /**
     * 풀러 인증서는 Supabase 자체 CA로 서명돼 있어 검증을 켜면 self-signed로 튕긴다.
     * 끄면 전송은 그대로 암호화되고 CA 검증만 건너뛴다 — CA 번들을 배포에 싣는 것보다
     * 이쪽이 낫다. **평문으로 붙는 것(ssl 미지정)보다는 훨씬 낫다.**
     */
    ssl: { rejectUnauthorized: false },
  });

  /**
   * 놀고 있는 연결이 끊길 때 나는 에러다. 안 받으면 프로세스가 그대로 죽는다 —
   * Supabase는 유휴 연결을 주기적으로 끊으므로 실제로 일어난다.
   */
  pool.on('error', (error) => {
    console.error('[db] 유휴 연결 오류:', error.message);
  });

  return pool;
}

export async function query<T extends QueryResultRow>(
  text: string,
  params?: unknown[],
): Promise<QueryResult<T>> {
  return getPool().query<T>(text, params);
}

/**
 * 트랜잭션 하나. 콜백이 던지면 롤백한다.
 *
 * `next_shelf_index()`의 advisory lock이 커밋까지 유지돼야 번호가 촘촘하므로,
 * 사진 제출은 반드시 이걸 통해야 한다(`db/schema.sql`「shelf_index 배정」).
 */
export async function transaction<T>(run: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await getPool().connect();
  try {
    await client.query('begin');
    const result = await run(client);
    await client.query('commit');
    return result;
  } catch (error) {
    await client.query('rollback').catch(() => {});
    throw error;
  } finally {
    client.release();
  }
}

/** 테스트 전용. 풀을 닫지 않으면 노드 테스트 러너가 끝나지 않는다. */
export async function closeDatabase(): Promise<void> {
  await pool?.end();
  pool = null;
}
