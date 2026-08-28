import { after } from 'next/server';
import type { Address, Hex } from 'viem';

import {
  AlreadyIssuedError,
  findIssuedMint,
  hasBeenIssued,
  mint,
  readMintReceipt,
  transactionDisappeared,
  waitForMint,
  type MintReceipt,
} from './chain';
import { buildCertificateMetadata, pinataFromEnv, type CertificateMetadata } from './ipfs';
import { readStoredPhoto, type Photo } from './storage';
import * as postgres from './store.pg';
import type { MintLockActions, PipelineEntry } from './store.shared';

type PipelineRepository = {
  getPipelineEntry(entryId: string): Promise<PipelineEntry | null>;
  saveCertificateCid(entryId: string, cid: string, expectedPath?: string): Promise<boolean>;
  pinMetadata(
    entryId: string,
    expectedPath: string,
    pin: (entry: PipelineEntry) => Promise<string>,
  ): Promise<PipelineEntry | null>;
  saveMinted(entryId: string, tokenId: string, txHash: Hex): Promise<void>;
  markPipelineFailed(
    entryId: string,
    reason: string,
    options?: { discardTxHash?: boolean },
  ): Promise<void>;
  withMintLock<T>(
    entryId: string,
    run: (entry: PipelineEntry, actions: MintLockActions) => Promise<T>,
  ): Promise<T | null>;
  findStaleMinting(now?: number): Promise<PipelineEntry[]>;
  sweep(now?: number): Promise<{ failed: number; hidden: number }>;
  withSweepLock<T>(run: () => Promise<T>): Promise<T | null>;
};

type IpfsGateway = {
  pinFile(photo: Photo, name: string): Promise<string>;
  pinJson(metadata: CertificateMetadata, name: string): Promise<string>;
};

type ChainGateway = {
  hasBeenIssued(recipient: Address): Promise<boolean>;
  mint(recipient: Address, metadataUri: string): Promise<Hex>;
  waitForMint(txHash: Hex): Promise<{ tokenId: string; txHash: Hex }>;
  readMintReceipt(txHash: Hex): Promise<MintReceipt | null>;
  transactionDisappeared(txHash: Hex): Promise<boolean>;
  findIssuedMint(recipient: Address): Promise<{ tokenId: string; txHash: Hex } | null>;
};

export type PipelineDependencies = {
  repository: PipelineRepository;
  ipfs: IpfsGateway;
  chain: ChainGateway;
  readPhoto(path: string): Promise<Photo>;
};

function productionDependencies(): PipelineDependencies {
  return {
    repository: postgres,
    ipfs: pinataFromEnv(),
    chain: { hasBeenIssued, mint, waitForMint, readMintReceipt, transactionDisappeared, findIssuedMint },
    readPhoto: readStoredPhoto,
  };
}

/**
 * Route Handler가 201을 내보낸 뒤 실행한다. 메모리 목은 기존
 * `schedulePipeline()`이 따로 있으므로 Next `after()`를 이중으로 걸지 않는다.
 */
export function runPipelineAfterResponse(entryId: string): void {
  if (!process.env.DATABASE_URL) return;
  after(async () => {
    try {
      await runPipeline(entryId);
    } catch (error) {
      // runPipeline이 실패를 DB에 남기는 것도 실패한 마지막 방어선.
      console.error('[pipeline] 복구하지 못한 오류:', errorMessage(error));
    }
  });
}

/** CID와 txHash가 이미 있으면 성공한 단계를 건너뛰고 그 뒤부터 재개한다. */
export async function runPipeline(
  entryId: string,
  dependencies?: PipelineDependencies,
): Promise<void> {
  if (!dependencies && !process.env.DATABASE_URL) return;
  const deps = dependencies ?? productionDependencies();
  let stage = '증서 이미지 핀';

  try {
    let entry = await deps.repository.getPipelineEntry(entryId);
    if (!entry || entry.status === 'MINTED') return;

    if (!entry.certificateCid) {
      const photo = await deps.readPhoto(entry.certificatePath);
      const cid = await deps.ipfs.pinFile(photo, `certificate-${entry.id}.${extension(photo.contentType)}`);
      const saved = await deps.repository.saveCertificateCid(entry.id, cid, entry.certificatePath);
      // 운영자가 새 사진을 붙였거나 다른 인보케이션이 먼저 이 단계를 끝냈다.
      // 이 실행이 계속되면 방금 핀한 옛 이미지로 새 시도의 메타데이터를 만들 수 있다.
      if (!saved) return;
      entry = requireEntry(await deps.repository.getPipelineEntry(entryId), entryId);
    }

    stage = '메타데이터 핀';
    if (!entry.metadataCid) {
      const locked = await deps.repository.pinMetadata(
        entry.id,
        entry.certificatePath,
        async (current) => {
          const metadata = buildCertificateMetadata({
            nickname: current.nickname,
            certificateCid: current.certificateCid!,
            submittedAt: current.submittedAt,
          });
          return deps.ipfs.pinJson(metadata, `metadata-${current.id}.json`);
        },
      );
      // 사진 교체나 초기화로 이 실행이 가리키던 행 버전이 사라졌다.
      if (!locked) return;
      entry = locked;
    }

    stage = '민팅';
    await mintEntry(entry.id, deps);
  } catch (error) {
    // 영수증 기록 전후에 인보케이션이 겹쳤을 수 있다. 체인에 이미 있다면
    // FAILED로 내리지 말고 이벤트로 완료한다.
    if (stage === '민팅' && (await recoverIssued(entryId, deps).catch(() => false))) return;

    const reason = `${stage} 실패: ${errorMessage(error)}`;
    await deps.repository.markPipelineFailed(entryId, reason).catch((recordError) => {
      throw new AggregateError([error, recordError], reason);
    });
  }
}

type MintOutcome = { kind: 'done' } | { kind: 'wait'; txHash: Hex };

async function mintEntry(entryId: string, deps: PipelineDependencies): Promise<void> {
  const outcome = await deps.repository.withMintLock<MintOutcome>(entryId, async (entry, actions) => {
    if (entry.status === 'MINTED') return { kind: 'done' };
    if (!entry.metadataCid) throw new Error('메타데이터 CID가 없습니다.');

    // 전송 후 영수증 대기 중 재시작된 경로. 단 그 해시가 아직 살아 있을 때만이다.
    //
    // CID는 한 번 성공하면 영원히 유효하지만 txHash는 아니다. nonce 경합에서 밀려난
    // 트랜잭션은 해시만 남기고 사라지고, 그것을 그대로 믿으면 재시도가 없는 영수증을
    // 20초씩 기다리다 실패하기를 반복한다. 운영자가 몇 번을 눌러도 같은 자리를 돈다.
    //
    // 여기 오는 것은 최초 전송으로부터 최소 20초(영수증 상한) 뒤다. 2초 블록에서 그만큼
    // 지났으면 살아 있는 트랜잭션은 이미 블록 안이라 mempool 가시성 차이를 걱정하지
    // 않아도 된다. 살아 있으면 조회 한 번으로 끝나므로 정상 경로가 치르는 값도 작다.
    if (entry.txHash) {
      if (!(await deps.chain.transactionDisappeared(entry.txHash))) {
        return { kind: 'wait', txHash: entry.txHash };
      }
      // 사라졌다. 아래로 내려가 새로 보내고, setMinting이 죽은 해시를 덮어쓴다.
    }

    const issued = await deps.chain.hasBeenIssued(entry.walletAddress);
    if (issued) {
      const recovered = await deps.chain.findIssuedMint(entry.walletAddress);
      if (!recovered) throw new Error('발급 이력은 있지만 CertificateIssued 이벤트를 찾지 못했습니다.');
      await actions.setMinted(recovered.tokenId, recovered.txHash);
      return { kind: 'done' };
    }

    try {
      const txHash = await deps.chain.mint(entry.walletAddress, `ipfs://${entry.metadataCid}`);
      await actions.setMinting(txHash);
      return { kind: 'wait', txHash };
    } catch (error) {
      if (!(error instanceof AlreadyIssuedError)) throw error;
      const recovered = await deps.chain.findIssuedMint(entry.walletAddress);
      if (!recovered) throw new Error('AlreadyIssued인데 CertificateIssued 이벤트를 찾지 못했습니다.');
      await actions.setMinted(recovered.tokenId, recovered.txHash);
      return { kind: 'done' };
    }
  });

  if (!outcome || outcome.kind === 'done') return;
  const receipt = await deps.chain.waitForMint(outcome.txHash);
  await deps.repository.saveMinted(entryId, receipt.tokenId, receipt.txHash);
}

async function recoverIssued(entryId: string, deps: PipelineDependencies): Promise<boolean> {
  const entry = await deps.repository.getPipelineEntry(entryId);
  if (!entry) return false;
  const recovered = await deps.chain.findIssuedMint(entry.walletAddress);
  if (!recovered) return false;
  await deps.repository.saveMinted(entry.id, recovered.tokenId, recovered.txHash);
  return true;
}

export type SweepResult = {
  failed: number;
  hidden: number;
  recovered: number;
  deferred: number;
};

/** 공개 RPC의 단일 mempool 관측만으로 pending 해시를 버리지 않도록 두는 최소 유예 시간. */
const MINT_DROP_GRACE_MS = 5 * 60 * 1_000;

/** MINTING은 영수증·이벤트를 먼저 본 뒤에만 FAILED로 내린다. */
export async function sweepPipeline(
  now: number = Date.now(),
  dependencies?: PipelineDependencies,
): Promise<SweepResult> {
  if (!dependencies && !process.env.DATABASE_URL) {
    const result = await import('./store.memory').then((memory) => memory.sweep(now));
    return { ...result, recovered: 0, deferred: 0 };
  }

  const deps = dependencies ?? productionDependencies();
  // Vercel Cron과 운영자 수동 점검이 겹쳐도 같은 항목을 두 번 집계하거나 동시에
  // 복구하지 않는다. 이미 실행 중이면 이번 호출은 멱등한 no-op이다.
  const result = await deps.repository.withSweepLock(() => sweepPipelineLocked(now, deps));
  return result ?? { failed: 0, hidden: 0, recovered: 0, deferred: 0 };
}

async function sweepPipelineLocked(
  now: number,
  deps: PipelineDependencies,
): Promise<SweepResult> {
  let recovered = 0;
  let mintingFailed = 0;
  let deferred = 0;

  for (const entry of await deps.repository.findStaleMinting(now)) {
    try {
      const receipt = entry.txHash ? await deps.chain.readMintReceipt(entry.txHash) : null;
      if (receipt?.status === 'success') {
        await deps.repository.saveMinted(entry.id, receipt.tokenId, receipt.txHash);
        recovered += 1;
        continue;
      }

      const issued = await deps.chain.findIssuedMint(entry.walletAddress);
      if (issued) {
        await deps.repository.saveMinted(entry.id, issued.tokenId, issued.txHash);
        recovered += 1;
        continue;
      }

      // 공개 RPC 노드마다 mempool이 다를 수 있다. 전송 후 충분히 오래 지난 해시만
      // 여러 번 조회하고, 하나라도 보이면 그대로 둔다.
      let gone = false;
      if (receipt === null && entry.txHash !== null) {
        if (now - entry.statusChangedAt.getTime() < MINT_DROP_GRACE_MS) {
          deferred += 1;
          continue;
        }
        gone = await deps.chain.transactionDisappeared(entry.txHash);
        if (!gone) {
          deferred += 1;
          continue;
        }
      }

      const reason = receipt?.status === 'reverted'
        ? '민팅 트랜잭션 실패 (스위퍼)'
        : gone
          ? '민팅 트랜잭션이 사라짐 (스위퍼)'
          : '민팅 영수증을 확인하지 못함 (스위퍼)';
      await deps.repository.markPipelineFailed(entry.id, reason, {
        // 확정 리버트이거나 5분 뒤 반복 조회에도 보이지 않을 때만 새 트랜잭션을 보낼 수 있다.
        // 아직 pending인 해시를 버리면 같은 발급이 두 번 나간다.
        discardTxHash: receipt?.status === 'reverted' || gone,
      });
      mintingFailed += 1;
    } catch (error) {
      // RPC 자체가 잠시 죽은 것을 체인 실패로 오인하지 않는다. 다음 cron이 다시 본다.
      deferred += 1;
      console.error(`[sweep] ${entry.id} 복구 조회 실패:`, errorMessage(error));
    }
  }

  const ordinary = await deps.repository.sweep(now);
  return {
    failed: ordinary.failed + mintingFailed,
    hidden: ordinary.hidden,
    recovered,
    deferred,
  };
}

function requireEntry(entry: PipelineEntry | null, entryId: string): PipelineEntry {
  if (!entry) throw new Error(`파이프라인 항목을 찾지 못했습니다: ${entryId}`);
  return entry;
}

function extension(contentType: string): string {
  if (contentType === 'image/png') return 'png';
  if (contentType === 'image/webp') return 'webp';
  return 'jpg';
}

function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message.slice(0, 800);
  return String(error).slice(0, 800);
}
