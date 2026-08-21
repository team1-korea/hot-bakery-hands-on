import assert from 'node:assert/strict';
import { beforeEach, test } from 'node:test';

import type { Address, Hex } from 'viem';

import { AlreadyIssuedError } from './chain';
import { runPipeline, sweepPipeline, type PipelineDependencies } from './pipeline';
import type { MintLockActions, PipelineEntry } from './store.shared';

const ENTRY_ID = '11111111-2222-3333-4444-555555555555';
const WALLET = '0x0000000000000000000000000000000000000101' as Address;
const TX = `0x${'1'.repeat(64)}` as Hex;
const RECOVERED_TX = `0x${'2'.repeat(64)}` as Hex;

function entry(patch: Partial<PipelineEntry> = {}): PipelineEntry {
  return {
    id: ENTRY_ID,
    nickname: '쿠키왕',
    status: 'SUBMITTED',
    walletAddress: WALLET,
    certificatePath: `entries/${ENTRY_ID}/certificate.jpg`,
    certificateCid: null,
    metadataCid: null,
    txHash: null,
    tokenId: null,
    submittedAt: new Date('2026-08-29T03:00:00.000Z'),
    statusChangedAt: new Date('2026-08-29T03:00:00.000Z'),
    ...patch,
  };
}

type PipelineRepository = PipelineDependencies['repository'];

class FakeRepository implements PipelineRepository {
  row: PipelineEntry | null = entry();
  stale: PipelineEntry[] = [];
  failures: string[] = [];
  ordinarySweep = { failed: 0, hidden: 0 };

  async getPipelineEntry() { return this.row; }
  async saveCertificateCid(_id: string, cid: string, expectedPath?: string) {
    if (!this.row || (expectedPath && this.row.certificatePath !== expectedPath) || this.row.certificateCid) {
      return false;
    }
    if (this.row) this.row = { ...this.row, certificateCid: cid };
    return true;
  }
  async pinMetadata(
    _id: string,
    expectedPath: string,
    pin: (entry: PipelineEntry) => Promise<string>,
  ) {
    if (!this.row || this.row.certificatePath !== expectedPath) return null;
    if (this.row.metadataCid) return this.row;
    const cid = await pin(this.row);
    this.row = { ...this.row, metadataCid: cid, status: 'PINNED' };
    return this.row;
  }
  async saveMinted(_id: string, tokenId: string, txHash: Hex) {
    if (this.row?.id === _id) this.row = { ...this.row, tokenId, txHash, status: 'MINTED' };
    const stale = this.stale.findIndex((candidate) => candidate.id === _id);
    if (stale >= 0) this.stale.splice(stale, 1);
  }
  async markPipelineFailed(_id: string, reason: string) {
    this.failures.push(reason);
    if (this.row?.id === _id) this.row = { ...this.row, status: 'FAILED' };
    const stale = this.stale.findIndex((candidate) => candidate.id === _id);
    if (stale >= 0) this.stale.splice(stale, 1);
  }
  async withMintLock<T>(
    _id: string,
    run: (locked: PipelineEntry, actions: MintLockActions) => Promise<T>,
  ): Promise<T | null> {
    if (!this.row) return null;
    return run(this.row, {
      setMinting: async (txHash) => {
        if (this.row) this.row = { ...this.row, status: 'MINTING', txHash };
      },
      setMinted: async (tokenId, txHash) => {
        if (this.row) this.row = { ...this.row, status: 'MINTED', tokenId, txHash };
      },
    });
  }
  async findStaleMinting() { return [...this.stale]; }
  async sweep() { return this.ordinarySweep; }
}

let repository: FakeRepository;
let calls: string[];
let deps: PipelineDependencies;

beforeEach(() => {
  repository = new FakeRepository();
  calls = [];
  deps = {
    repository,
    readPhoto: async () => {
      calls.push('read-photo');
      return { bytes: new Uint8Array([1, 2, 3]), contentType: 'image/jpeg' };
    },
    ipfs: {
      pinFile: async () => { calls.push('pin-file'); return 'bafy-certificate'; },
      pinJson: async (metadata) => {
        calls.push(`pin-json:${metadata.image}`);
        return 'bafy-metadata';
      },
    },
    chain: {
      hasBeenIssued: async () => { calls.push('has-issued'); return false; },
      mint: async (_recipient, uri) => { calls.push(`mint:${uri}`); return TX; },
      waitForMint: async () => { calls.push('receipt'); return { tokenId: '42', txHash: TX }; },
      readMintReceipt: async () => null,
      findIssuedMint: async () => null,
    },
  };
});

test('첫 실행은 파일→JSON→직렬 민팅→영수증 순으로 MINTED가 된다', async () => {
  await runPipeline(ENTRY_ID, deps);

  assert.deepEqual(calls, [
    'read-photo',
    'pin-file',
    'pin-json:ipfs://bafy-certificate',
    'has-issued',
    'mint:ipfs://bafy-metadata',
    'receipt',
  ]);
  assert.equal(repository.row?.status, 'MINTED');
  assert.equal(repository.row?.certificateCid, 'bafy-certificate');
  assert.equal(repository.row?.metadataCid, 'bafy-metadata');
  assert.equal(repository.row?.tokenId, '42');
});

test('certificate CID가 있으면 파일 핀을 건너뛴다', async () => {
  repository.row = entry({ certificateCid: 'bafy-existing' });
  await runPipeline(ENTRY_ID, deps);

  assert.ok(!calls.includes('read-photo'));
  assert.ok(!calls.includes('pin-file'));
  assert.ok(calls.includes('pin-json:ipfs://bafy-existing'));
});

test('파일 핀 도중 사진이 교체되면 옛 이미지로 메타데이터·민팅을 계속하지 않는다', async () => {
  deps.ipfs.pinFile = async () => {
    calls.push('pin-file');
    repository.row = entry({ certificatePath: 'entries/new-attempt/certificate.jpg' });
    return 'bafy-stale-certificate';
  };

  await runPipeline(ENTRY_ID, deps);

  assert.deepEqual(calls, ['read-photo', 'pin-file']);
  assert.equal(repository.row?.certificateCid, null);
  assert.ok(!calls.some((call) => call.startsWith('pin-json:')));
  assert.ok(!calls.some((call) => call.startsWith('mint:')));
});

test('메타데이터는 초기 조회값이 아니라 잠근 행의 최신 닉네임으로 만든다', async () => {
  repository.row = entry({ certificateCid: 'bafy-certificate' });
  const originalPinMetadata = repository.pinMetadata.bind(repository);
  repository.pinMetadata = async (id, expectedPath, pin) => {
    if (repository.row) repository.row = { ...repository.row, nickname: '잠금직전수정' };
    return originalPinMetadata(id, expectedPath, pin);
  };
  deps.ipfs.pinJson = async (metadata) => {
    assert.match(metadata.name, /잠금직전수정/);
    return 'bafy-metadata';
  };

  await runPipeline(ENTRY_ID, deps);
  assert.equal(repository.row?.status, 'MINTED');
});

test('metadata CID가 있으면 IPFS를 모두 건너뛰고 민팅부터 재개한다', async () => {
  repository.row = entry({
    status: 'PINNED',
    certificateCid: 'bafy-certificate',
    metadataCid: 'bafy-metadata',
  });
  await runPipeline(ENTRY_ID, deps);

  assert.deepEqual(calls, ['has-issued', 'mint:ipfs://bafy-metadata', 'receipt']);
});

test('txHash가 있으면 다시 보내지 않고 영수증만 확인한다', async () => {
  repository.row = entry({
    status: 'MINTING',
    certificateCid: 'bafy-certificate',
    metadataCid: 'bafy-metadata',
    txHash: TX,
  });
  await runPipeline(ENTRY_ID, deps);

  assert.deepEqual(calls, ['receipt']);
  assert.equal(repository.row?.status, 'MINTED');
});

test('이미 발급된 주소는 이벤트로 tokenId·txHash를 복구한다', async () => {
  repository.row = entry({
    status: 'PINNED',
    certificateCid: 'bafy-certificate',
    metadataCid: 'bafy-metadata',
  });
  deps.chain.hasBeenIssued = async () => true;
  deps.chain.findIssuedMint = async () => ({ tokenId: '7', txHash: RECOVERED_TX });

  await runPipeline(ENTRY_ID, deps);

  assert.equal(repository.row?.status, 'MINTED');
  assert.equal(repository.row?.tokenId, '7');
  assert.equal(repository.row?.txHash, RECOVERED_TX);
  assert.ok(!calls.some((call) => call.startsWith('mint:')));
});

test('mint가 AlreadyIssued로 경합해도 이벤트로 복구한다', async () => {
  repository.row = entry({
    status: 'PINNED', certificateCid: 'bafy-certificate', metadataCid: 'bafy-metadata',
  });
  deps.chain.mint = async () => { throw new AlreadyIssuedError(WALLET); };
  deps.chain.findIssuedMint = async () => ({ tokenId: '8', txHash: RECOVERED_TX });

  await runPipeline(ENTRY_ID, deps);
  assert.equal(repository.row?.status, 'MINTED');
  assert.equal(repository.row?.tokenId, '8');
});

test('실패 단계를 운영자 사유로 남기고 FAILED로 내린다', async () => {
  deps.ipfs.pinFile = async () => { throw new Error('gateway timeout'); };
  await runPipeline(ENTRY_ID, deps);

  assert.equal(repository.row?.status, 'FAILED');
  assert.match(repository.failures[0], /증서 이미지 핀 실패.*gateway timeout/);
});

test('스위퍼는 MINTING 영수증을 복구하고, RPC 오류는 FAILED로 오인하지 않는다', async () => {
  const recovered = entry({ status: 'MINTING', txHash: TX, metadataCid: 'bafy', certificateCid: 'bafy' });
  const deferred = entry({
    id: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
    status: 'MINTING',
    txHash: RECOVERED_TX,
    metadataCid: 'bafy2',
    certificateCid: 'bafy2',
  });
  repository.row = recovered;
  repository.stale = [recovered, deferred];
  repository.ordinarySweep = { failed: 2, hidden: 1 };
  deps.chain.readMintReceipt = async (hash) => {
    if (hash === RECOVERED_TX) throw new Error('RPC unavailable');
    return { status: 'success', tokenId: '55', txHash: hash };
  };

  const result = await sweepPipeline(Date.now(), deps);

  assert.deepEqual(result, { failed: 2, hidden: 1, recovered: 1, deferred: 1 });
  assert.ok(!repository.failures.some((reason) => reason.includes('RPC unavailable')));
});
