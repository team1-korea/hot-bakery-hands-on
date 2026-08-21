import assert from 'node:assert/strict';
import { test } from 'node:test';

import type { LinkedAccount } from '@privy-io/node';

import {
  WalletNotFoundError,
  callerFrom,
  callerFromPrivy,
  didFrom,
  didFromPrivy,
  type PrivyGateway,
} from './auth';

const DID = 'did:privy:test-user';
const OTHER_DID = 'did:privy:other-user';
const ADDRESS = '0xABCDEFabcdefABCDEFabcdefABCDEFabcdefABCD';
const SECOND_ADDRESS = '0x1111111111111111111111111111111111111111';

function request(token?: string, authorization?: string) {
  return new Request('http://localhost/api', {
    headers: authorization
      ? { authorization }
      : token
        ? { authorization: `Bearer ${token}` }
        : undefined,
  });
}

type FakeOptions = {
  verifyError?: Error;
  userError?: Error;
  userId?: string;
};

function fake(accounts: LinkedAccount[], options: FakeOptions = {}) {
  const calls = { verify: 0, getUser: 0 };
  const gateway: PrivyGateway = {
    async verifyAccessToken(token) {
      calls.verify += 1;
      assert.equal(token, 'valid-token');
      if (options.verifyError) throw options.verifyError;
      return { user_id: DID };
    },
    async getUser(did) {
      calls.getUser += 1;
      assert.equal(did, DID);
      if (options.userError) throw options.userError;
      return { id: options.userId ?? DID, linked_accounts: accounts };
    },
  };
  return { gateway, calls };
}

function embeddedEthereum(address = ADDRESS, walletIndex = 0): LinkedAccount {
  return {
    type: 'wallet',
    address,
    chain_type: 'ethereum',
    connector_type: 'embedded',
    wallet_client_type: 'privy',
    wallet_index: walletIndex,
  } as LinkedAccount;
}

async function withPrivyEnv(
  values: Partial<Record<'NODE_ENV' | 'PRIVY_APP_ID' | 'NEXT_PUBLIC_PRIVY_APP_ID' | 'PRIVY_APP_SECRET', string>>,
  run: () => Promise<void>,
) {
  const env = process.env as Record<string, string | undefined>;
  const keys = [
    'NODE_ENV',
    'PRIVY_APP_ID',
    'NEXT_PUBLIC_PRIVY_APP_ID',
    'PRIVY_APP_SECRET',
  ] as const;
  const previous = Object.fromEntries(keys.map((key) => [key, env[key]]));

  for (const key of keys) delete env[key];
  Object.assign(env, values);

  try {
    await run();
  } finally {
    for (const key of keys) {
      const value = previous[key];
      if (value === undefined) delete env[key];
      else env[key] = value;
    }
  }
}

test('검증된 DID와 Privy embedded Ethereum 주소만 반환한다', async () => {
  const { gateway, calls } = fake([embeddedEthereum()]);
  const caller = await callerFromPrivy(request('valid-token'), gateway);

  assert.deepEqual(caller, { did: DID, walletAddress: ADDRESS.toLowerCase() });
  assert.deepEqual(calls, { verify: 1, getUser: 1 });
});

test('외부 Ethereum 지갑보다 Privy embedded 지갑을 고른다', async () => {
  const external = {
    type: 'wallet',
    address: SECOND_ADDRESS,
    chain_type: 'ethereum',
    connector_type: 'injected',
    wallet_client_type: 'metamask',
  } as LinkedAccount;
  const { gateway } = fake([external, embeddedEthereum()]);

  assert.deepEqual(
    await callerFromPrivy(request('valid-token'), gateway),
    { did: DID, walletAddress: ADDRESS.toLowerCase() },
  );
});

test('embedded Ethereum 지갑이 여럿이면 가장 낮은 wallet_index를 결정적으로 고른다', async () => {
  const { gateway } = fake([
    embeddedEthereum(SECOND_ADDRESS, 2),
    embeddedEthereum(ADDRESS, 0),
  ]);

  assert.deepEqual(
    await callerFromPrivy(request('valid-token'), gateway),
    { did: DID, walletAddress: ADDRESS.toLowerCase() },
  );
});

test('외부·Solana·잘못된 주소만 있으면 WALLET_NOT_FOUND다', async () => {
  const accounts = [
    {
      type: 'wallet',
      address: SECOND_ADDRESS,
      chain_type: 'ethereum',
      connector_type: 'injected',
      wallet_client_type: 'metamask',
    },
    {
      type: 'wallet',
      address: '8xYqP4ZxYz',
      chain_type: 'solana',
      connector_type: 'embedded',
      wallet_client_type: 'privy',
      wallet_index: 0,
    },
    {
      type: 'wallet',
      address: '0xnot-an-address',
      chain_type: 'ethereum',
      connector_type: 'embedded',
      wallet_client_type: 'privy',
      wallet_index: 0,
    },
  ] as LinkedAccount[];
  const { gateway } = fake(accounts);

  await assert.rejects(
    () => callerFromPrivy(request('valid-token'), gateway),
    WalletNotFoundError,
  );
});

test('linked account가 없으면 WALLET_NOT_FOUND로 구분한다', async () => {
  const { gateway } = fake([]);
  await assert.rejects(
    () => callerFromPrivy(request('valid-token'), gateway),
    WalletNotFoundError,
  );
});

test('Bearer 토큰이 없거나 형식이 잘못되면 gateway를 호출하지 않는다', async () => {
  for (const authorization of [undefined, 'Basic abc', 'Bearer', 'Bearer token with-space']) {
    const { gateway, calls } = fake([]);
    assert.equal(await callerFromPrivy(request(undefined, authorization), gateway), null);
    assert.deepEqual(calls, { verify: 0, getUser: 0 });
  }
});

test('access token 검증 실패는 401로 매핑할 수 있도록 null이다', async () => {
  const { gateway, calls } = fake([], { verifyError: new Error('invalid token') });

  assert.equal(await callerFromPrivy(request('valid-token'), gateway), null);
  assert.deepEqual(calls, { verify: 1, getUser: 0 });
});

test('Users API가 다른 DID를 반환하면 다른 지갑으로 민팅하지 않고 잠근다', async () => {
  const { gateway } = fake([embeddedEthereum()], { userId: OTHER_DID });
  assert.equal(await callerFromPrivy(request('valid-token'), gateway), null);
});

test('Users API 실패는 인증을 열지 않고 null로 닫는다', async () => {
  const { gateway, calls } = fake([], { userError: new Error('temporarily unavailable') });

  assert.equal(await callerFromPrivy(request('valid-token'), gateway), null);
  assert.deepEqual(calls, { verify: 1, getUser: 1 });
});

test('등록 뒤 조회는 access token에서 DID만 얻고 Users API를 다시 호출하지 않는다', async () => {
  const { gateway, calls } = fake([embeddedEthereum()]);

  assert.equal(await didFromPrivy(request('valid-token'), gateway), DID);
  assert.deepEqual(calls, { verify: 1, getUser: 0 });
});

test('운영 환경은 Privy 설정이 통째로 빠져도 목 참가자로 열리지 않는다', async () => {
  await withPrivyEnv({ NODE_ENV: 'production' }, async () => {
    assert.equal(await callerFrom(request()), null);
    assert.equal(await didFrom(request()), null);
  });
});

test('개발 환경도 Privy 설정이 일부만 있으면 목 인증으로 우회하지 않는다', async () => {
  await withPrivyEnv({ NODE_ENV: 'development', PRIVY_APP_ID: 'app-id-only' }, async () => {
    assert.equal(await callerFrom(request()), null);
    assert.equal(await didFrom(request()), null);
  });
});

test('개발 환경에서 Privy 설정이 없으면 식별자별로 안정적인 목 참가자를 만든다', async () => {
  await withPrivyEnv({ NODE_ENV: 'development' }, async () => {
    const firstRequest = new Request('http://localhost/api', {
      headers: { 'x-dev-participant': 'alice' },
    });
    const sameRequest = new Request('http://localhost/api', {
      headers: { 'x-dev-participant': 'alice' },
    });
    const otherRequest = new Request('http://localhost/api', {
      headers: { 'x-dev-participant': 'bob' },
    });

    const first = await callerFrom(firstRequest);
    assert.deepEqual(await callerFrom(sameRequest), first);
    assert.notEqual((await callerFrom(otherRequest))?.did, first?.did);
    assert.equal(await didFrom(firstRequest), first?.did);
  });
});
