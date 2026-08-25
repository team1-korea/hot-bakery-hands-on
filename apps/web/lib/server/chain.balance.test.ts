import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { test } from 'node:test';

const TEST_PRIVATE_KEY = `0x${'1'.repeat(64)}`;

test('느린 민터 잔액 RPC는 짧게 포기하고 동시 조회를 하나로 합친다', async (context) => {
  let requests = 0;
  const server = createServer(() => {
    requests += 1;
    // RPC가 연결만 받고 응답하지 않는 장애를 재현한다.
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));

  const address = server.address();
  assert.ok(address && typeof address !== 'string');

  const previousRpc = process.env.AVALANCHE_RPC_URL;
  const previousKey = process.env.MINTER_PRIVATE_KEY;
  const previousChainId = process.env.NEXT_PUBLIC_CHAIN_ID;
  process.env.AVALANCHE_RPC_URL = `http://127.0.0.1:${address.port}`;
  process.env.MINTER_PRIVATE_KEY = TEST_PRIVATE_KEY;
  process.env.NEXT_PUBLIC_CHAIN_ID = '43113';

  context.after(async () => {
    if (previousRpc === undefined) delete process.env.AVALANCHE_RPC_URL;
    else process.env.AVALANCHE_RPC_URL = previousRpc;
    if (previousKey === undefined) delete process.env.MINTER_PRIVATE_KEY;
    else process.env.MINTER_PRIVATE_KEY = previousKey;
    if (previousChainId === undefined) delete process.env.NEXT_PUBLIC_CHAIN_ID;
    else process.env.NEXT_PUBLIC_CHAIN_ID = previousChainId;
    server.closeAllConnections();
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  const { minterBalance } = await import('./chain');
  let timeoutId: NodeJS.Timeout | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(
      () => reject(new Error('민터 잔액 조회가 관리자 폴링 제한 안에 끝나지 않았다')),
      2_000,
    );
  });

  let balances: Awaited<ReturnType<typeof minterBalance>>[];
  try {
    balances = await Promise.race([
      Promise.all([minterBalance(), minterBalance()]),
      timeout,
    ]);
  } finally {
    clearTimeout(timeoutId);
  }

  assert.deepEqual(balances, [null, null]);
  assert.equal(requests, 1);
});
