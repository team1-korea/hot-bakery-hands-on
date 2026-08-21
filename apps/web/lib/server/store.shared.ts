import type { Address, Hex } from 'viem';

import type { Entry, EntryStatus } from '@/lib/api/types';

/**
 * 메모리 구현과 Postgres 구현이 같이 쓰는 것들. 두 곳에 나눠 적으면 스위퍼 시간 같은
 * 값이 조용히 어긋난다.
 */

export type AttachFailure = 'NOT_FOUND' | 'ALREADY_SUBMITTED' | 'SHOWCASE_FULL';
export type AttachResult = { ok: true; entry: Entry } | { ok: false; code: AttachFailure };
export type NicknameUpdateResult =
  | { ok: true; entry: Entry }
  | { ok: false; code: 'NOT_FOUND' | 'ALREADY_SUBMITTED' };
export type ResetResult = { deleted: { participants: number; entries: number } };

/** 참가자·공개 응답에는 내부 장애 원문을 내보내지 않는다. */
export function withoutFailureReason(entry: Entry): Entry {
  return { ...entry, failureReason: null };
}

/** 중간 상태(오븐 안)로 이만큼 멈춰 있으면 스위퍼가 FAILED로 내린다. */
export const STUCK_MS = 5 * 60 * 1_000;

/** 사진 없이 JOINED로 이만큼 방치되면 스위퍼가 TV에서 내린다. */
export const ABANDONED_JOIN_MS = 10 * 60 * 1_000;

/** 스위퍼가 내린 행에 남기는 사유. 운영자가 화면에서 이 문구로 구분한다. */
export const SWEPT_REASON = '처리 중 멈춤 (스위퍼)';

/**
 * 화면에 나가는 `Entry`와 달리, 발행 파이프라인만 보는 내부 행이다.
 * DID는 필요 없고 지갑 주소만 참가자 테이블에서 가져온다.
 */
export type PipelineEntry = {
  id: string;
  nickname: string;
  status: EntryStatus;
  walletAddress: Address;
  certificatePath: string;
  certificateCid: string | null;
  metadataCid: string | null;
  txHash: Hex | null;
  tokenId: string | null;
  submittedAt: Date;
  statusChangedAt: Date;
};

export type MintLockActions = {
  setMinting(txHash: Hex): Promise<void>;
  setMinted(tokenId: string, txHash: Hex): Promise<void>;
};
