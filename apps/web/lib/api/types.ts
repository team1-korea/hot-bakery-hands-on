/**
 * 프론트엔드와 백엔드가 공유하는 API 계약.
 *
 * 백엔드 구현 전까지 `app/api/`의 목 라우트가 이 계약을 그대로 만족시킨다.
 * 계약을 바꾸려면 이 파일을 먼저 고치고 목 라우트와 화면을 함께 맞춘다.
 */

/**
 * 발행 파이프라인 상태. 백엔드는 이 순서로만 전이시키고, 실패는 어느 단계에서든 FAILED로 간다.
 * MINTED는 트랜잭션 제출이 아니라 영수증 성공과 CertificateIssued 이벤트를 확인한 뒤에만 쓴다.
 */
export type EntryStatus =
  | 'SUBMITTED'
  | 'RENDERED'
  | 'PINNED'
  | 'MINTING'
  | 'MINTED'
  | 'FAILED';

export type Entry = {
  id: string;
  nickname: string;
  status: EntryStatus;
  /** 참가자가 올린 원본 쿠키 사진. */
  photoUrl: string | null;
  /** 합성이 끝난 증서 이미지. RENDERED 이후에 채워진다. */
  certificateUrl: string | null;
  /** uint256이므로 문자열로 내려준다. JSON에 bigint를 넣지 않는다. */
  tokenId: string | null;
  txHash: string | null;
  /** 진열장 슬롯 번호(0-based). 제출 순서대로 배정하고 이후 바뀌지 않는다. */
  shelfIndex: number | null;
  /** 운영자가 TV에서 내린 카드. */
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
export const SHELF_SLOTS = 15;

/** 받을 수 있는 참가자 수. 진열장 두 쪽이다. */
export const MAX_ENTRIES = SHELF_SLOTS * 2;

export type StateResponse = {
  entries: Entry[];
  show: ShowState;
  counts: { submitted: number; minted: number };
};

export type Session = {
  participantId: string;
  email: string;
};

export type ApiErrorBody = {
  error: {
    code: ApiErrorCode;
    message: string;
  };
};

export type ApiErrorCode =
  | 'INVALID_EMAIL'
  | 'INVALID_CODE'
  | 'UNAUTHENTICATED'
  | 'ALREADY_SUBMITTED'
  | 'INVALID_PHOTO'
  | 'INVALID_NICKNAME'
  | 'SHOWCASE_FULL'
  | 'NOT_FOUND'
  | 'INTERNAL';
