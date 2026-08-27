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
  /** 현재 숨긴 카드를 스위퍼가 자동으로 내렸는지. */
  autoHidden: boolean;
  /** 메타데이터가 아직 IPFS에 올라가지 않아 닉네임을 안전하게 고칠 수 있는지. */
  nicknameEditable: boolean;
};

export type AdminStateResponse = {
  entries: AdminEntry[];
  show: ShowState;
  counts: { submitted: number; minted: number };
  /** 배포 환경에 따라 달라지는 운영자 화면 기능. 클라이언트가 환경변수를 추측하지 않는다. */
  capabilities: {
    resetDatabase: boolean;
    mockServer: boolean;
  };
  /** 민터 지갑 잔액(wei 문자열). 키가 없거나 체인 조회에 실패하면 null이다. */
  minter: { address: string; wei: string } | null;
  /** 서버 파이프라인이 실제로 사용하는 체인 설정. 부하 리허설의 안전 확인에도 쓴다. */
  chain: { id: number; customRpc: boolean };
};
