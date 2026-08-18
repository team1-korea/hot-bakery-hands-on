export type CommonJoinStage =
  | 'email'
  | 'code'
  | 'photo'
  | 'nickname'
  | 'submit';

export type JoinSubmission = {
  nickname: string;
  photoPreview: string | null;
  shelfNumber: number;
  tokenId: number;
};

export const STEP_NUMBER: Record<CommonJoinStage, number> = {
  email: 1,
  code: 1,
  photo: 2,
  nickname: 3,
  submit: 4,
};

export const STEP_LABELS = ['로그인', '사진', '이름', '제출'] as const;
