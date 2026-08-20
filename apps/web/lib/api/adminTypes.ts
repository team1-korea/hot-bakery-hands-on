import type { Entry, ShowState } from './types';

/**
 * 운영자 화면 전용 응답 계약.
 *
 * 공개 `GET /api/state`(`StateResponse`)와 **일부러 다른 타입**이다. 같은 타입을 쓰면
 * 인증 여부에 따라 필드를 채웠다 비웠다 하게 되고, 그러면 캐시 헤더 한 줄이나 CDN 설정
 * 하나만 잘못돼도 실패 사유와 지갑 주소가 TV URL로 새어 나간다. 타입을 나눠 두면
 * 공개 응답을 만드는 코드가 이 필드들을 애초에 손에 쥘 수 없다.
 */
export type AdminEntry = Entry & {
  /** 참가자 지갑 주소. 체인에서 발행 결과를 대조할 때 쓴다. */
  walletAddress: string;
  /** 스위퍼가 자동으로 내린 카드인지. 운영자가 직접 내린 것과 구분한다. */
  autoHidden: boolean;
};

export type AdminStateResponse = {
  entries: AdminEntry[];
  show: ShowState;
  counts: { submitted: number; minted: number };
};
