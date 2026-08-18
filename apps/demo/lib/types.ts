export type EntryStatus =
  | 'SUBMITTED'   // 사진 제출 완료
  | 'RENDERED'    // 증서 이미지 합성 완료
  | 'PINNED'      // IPFS 업로드 완료
  | 'MINTING'     // 민팅 트랜잭션 진행 중
  | 'MINTED'      // 발행 완료
  | 'FAILED';

export type Entry = {
  id: string;
  nickname: string;
  status: EntryStatus;
  photoUrl: string | null;        // 참가자 원본 쿠키 사진
  certificateUrl: string | null;  // 최종 증서 이미지 (MINTED일 때만)
  tokenId: number | null;
  txHash: string | null;
  shelfIndex: number | null;      // 진열장 슬롯 0~14, 제출 순서대로 고정 배정
  hidden: boolean;                // 운영자가 TV에서 내린 카드
};

export type ShowState = {
  mode: 'BAKERY' | 'SLIDES';
  layout: 'LIVE' | 'GALLERY';
  slideIndex: number;
  qrVisible: boolean;
  spotlightEntryId: string | null;
};

export type StateResponse = {
  entries: Entry[];
  show: ShowState;
  counts: { submitted: number; minted: number };
};
