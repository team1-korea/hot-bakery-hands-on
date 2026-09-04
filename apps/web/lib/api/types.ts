/**
 * 프론트엔드와 백엔드가 공유하는 API 계약.
 *
 * `app/api/`의 메모리 목과 실제 백엔드가 모두 이 계약을 만족시킨다.
 * 계약을 바꾸려면 이 파일을 먼저 고치고 두 저장소 구현과 화면을 함께 맞춘다.
 */

/**
 * 발행 파이프라인 상태. 백엔드는 이 순서로만 전이시키고, 실패는 어느 단계에서든 FAILED로 간다.
 * MINTED는 트랜잭션 제출이 아니라 영수증 성공과 CertificateIssued 이벤트를 확인한 뒤에만 쓴다.
 *
 * TV의 세 구역은 "누가 손대야 하는가"로 나뉜다.
 *   작업대 = JOINED·FAILED (사람 손이 필요)
 *   오븐   = SUBMITTED·PINNED·MINTING (기계가 처리 중)
 *   진열장 = MINTED (끝)
 */
export type EntryStatus =
  | 'JOINED'
  | 'SUBMITTED'
  | 'PINNED'
  | 'MINTING'
  | 'MINTED'
  | 'FAILED';

export type Entry = {
  id: string;
  nickname: string;
  status: EntryStatus;
  /** 프론트가 프레임까지 합성해 올린 증서 이미지. JOINED에서는 null이다. */
  photoUrl: string | null;
  /** uint256이므로 문자열로 내려준다. JSON에 bigint를 넣지 않는다. */
  tokenId: string | null;
  txHash: string | null;
  /**
   * 진열장 슬롯 번호(0-based). JOINED에서는 null이고, 사진 제출 때 배정된 뒤 바뀌지 않는다.
   * 등록 시점에 배정하면 로그인만 하고 사라진 사람이 칸을 영구히 점유해 격자에 구멍이 남는다.
   */
  shelfIndex: number | null;
  /** 운영자 또는 스위퍼가 TV에서 숨긴 카드. */
  hidden: boolean;
  /** FAILED일 때만 채운다. 참가자에게 그대로 보여주지 않는다. */
  failureReason: string | null;
  /** ISO 8601. */
  submittedAt: string;
};

export type ShowState = {
  /** LIVE는 작업대와 오븐을 함께 보여주고, GALLERY는 진열장만 크게 보여준다. */
  layout: 'LIVE' | 'GALLERY';
  qrVisible: boolean;
  /** 지금 앞 화면에 보이는 진열장 쪽(0부터). 넘기는 것은 사람이 한다. */
  shelfPage: number;
};

/** 진열장 한 쪽의 칸 수. 1920×1080에서 3~5m 거리 가독성을 지키는 5×3 격자다. */
/**
 * 중간 상태(오븐 안)로 이만큼 멈춰 있으면 스위퍼가 FAILED로 내린다.
 *
 * 운영자 화면도 이 값을 본다 — 카드가 이 선을 넘으면 「멈춘 작업 점검/복구」가 실제로
 * 집어갈 수 있다는 뜻이고, 그때부터 눈에 띄게 표시한다. 서버와 화면이 따로 적으면
 * 기준이 조용히 어긋나므로 여기 한 곳에 둔다.
 */
export const STUCK_MS = 90 * 1_000;

export const SHELF_SLOTS = 15;

/** 받을 수 있는 참가자 수. 진열장 두 쪽이다. */
export const MAX_ENTRIES = SHELF_SLOTS * 2;

export type StateResponse = {
  entries: Entry[];
  show: ShowState;
  counts: { submitted: number; minted: number };
};

/** 지갑 안내에서 현재 Privy 지갑이 실제 발급 기록과 일치하는지만 공개한다. */
export type WalletGuideEligibilityResponse = {
  eligible: boolean;
};

export type ApiErrorBody = {
  error: {
    code: ApiErrorCode;
    message: string;
  };
};

export type ApiErrorCode =
  | 'UNAUTHENTICATED'
  | 'WALLET_NOT_FOUND'
  | 'ALREADY_SUBMITTED'
  | 'INVALID_PHOTO'
  | 'INVALID_NICKNAME'
  | 'INVALID_REQUEST'
  | 'SHOWCASE_FULL'
  | 'NOT_FOUND'
  | 'INTERNAL';
