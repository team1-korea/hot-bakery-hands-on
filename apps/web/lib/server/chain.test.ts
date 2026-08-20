import assert from 'node:assert/strict';
import { test } from 'node:test';

import type { Address } from 'viem';
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts';

import {
  AlreadyIssuedError,
  findIssuedTokenId,
  hasBeenIssued,
  simulateMint,
} from './chain';

/**
 * 실제 Fuji 배포본을 그대로 두드린다. 목을 쓰면 정작 확인하고 싶은 것 —
 * 리버트 사유가 제대로 디코드되는지, 로그 조회가 실제로 걸리는지 — 이 빠진다.
 *
 * 민터 개인키는 암호화된 keystore 안에 있어 여기서 쓸 수 없다. 그래서 **전송은 하지 않는다.**
 * 읽기와 시뮬레이션만으로 확인 가능한 것만 담았다.
 */

/** contracts/FUJI_SMOKE_TEST.md의 스모크 테스트 결과. */
const MINTER = '0x10dD14002A7EfFAEb52272BC2e04a6113d0ff608' as Address;
const ADMIN = '0x7a227D5902cA52C0C3C61304533bfF4632Fce145' as Address;

/** batchMint로 Token ID 2를 받은 주소. 소각·재발급이 얽히지 않은 가장 깨끗한 발급 이력이다. */
const BATCH_RECIPIENT = '0x0000000000000000000000000000000000000101' as Address;

const METADATA_URI = 'ipfs://bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi';

/** 발급 이력이 있을 수 없는 주소. 매번 새로 만든다. */
function freshAddress(): Address {
  return privateKeyToAccount(generatePrivateKey()).address;
}

test('hasBeenIssued: 발급 이력이 있는 주소는 true', async () => {
  assert.equal(await hasBeenIssued(BATCH_RECIPIENT), true);
});

test('hasBeenIssued: 처음 보는 주소는 false', async () => {
  assert.equal(await hasBeenIssued(freshAddress()), false);
});

test('findIssuedTokenId: 실제 로그에서 tokenId를 건져 온다', async () => {
  const tokenId = await findIssuedTokenId(BATCH_RECIPIENT);
  assert.equal(tokenId, '2');
});

test('findIssuedTokenId: tokenId는 bigint가 아니라 문자열이다', async () => {
  const tokenId = await findIssuedTokenId(BATCH_RECIPIENT);
  assert.equal(typeof tokenId, 'string');
  // JSON으로 나갈 수 있어야 한다. bigint면 여기서 TypeError가 난다.
  assert.equal(JSON.stringify({ tokenId }), '{"tokenId":"2"}');
});

test('findIssuedTokenId: 발급받은 적 없는 주소는 null', async () => {
  assert.equal(await findIssuedTokenId(freshAddress()), null);
});

/**
 * 관리자 주소는 Token ID 1을 받았다가 소각당하고 Token ID 4로 재발급받았다.
 * `CertificateIssued`만 보므로 결과는 **1**이다 — 재발급분은 다른 이벤트로 나간다.
 * 파이프라인의 복구 경로에는 문제가 없다(복구 대상은 언제나 최초 발급 건이다).
 */
test('findIssuedTokenId: 소각된 최초 발급 건도 그대로 나온다', async () => {
  assert.equal(await findIssuedTokenId(ADMIN), '1');
});

test('simulateMint: 새 주소는 민터 계정으로 시뮬레이션이 통과한다', async () => {
  const recipient = freshAddress();
  const { result } = await simulateMint(recipient, METADATA_URI, MINTER);

  // mint의 반환값은 발급될 tokenId다. 확정값이 아니므로 저장하지 않는다.
  assert.equal(typeof result, 'bigint');
});

test('simulateMint: 이미 발행된 주소는 AlreadyIssuedError로 분류된다', async () => {
  await assert.rejects(
    () => simulateMint(BATCH_RECIPIENT, METADATA_URI, MINTER),
    (error: unknown) => {
      assert.ok(error instanceof AlreadyIssuedError, `AlreadyIssuedError가 아님: ${error}`);
      assert.equal(error.recipient, BATCH_RECIPIENT);
      return true;
    },
  );
});

/** AlreadyIssued만 골라내야 한다. 다른 리버트까지 복구 경로로 보내면 발급되지 않은 건을 MINTED로 올린다. */
test('simulateMint: 권한 없는 주소의 리버트는 AlreadyIssuedError가 아니다', async () => {
  await assert.rejects(
    () => simulateMint(freshAddress(), METADATA_URI, freshAddress()),
    (error: unknown) => {
      assert.ok(!(error instanceof AlreadyIssuedError), '권한 오류를 이미 발행으로 오인함');
      assert.match(String(error), /AccessControlUnauthorizedAccount/);
      return true;
    },
  );
});

test('simulateMint: 빈 metadataURI는 EmptyTokenURI로 리버트한다', async () => {
  await assert.rejects(
    () => simulateMint(freshAddress(), '', MINTER),
    (error: unknown) => {
      assert.ok(!(error instanceof AlreadyIssuedError));
      assert.match(String(error), /EmptyTokenURI/);
      return true;
    },
  );
});
