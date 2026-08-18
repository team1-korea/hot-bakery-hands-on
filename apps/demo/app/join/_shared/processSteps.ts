export const PROCESS_STEPS = [
  ['사진 저장됨', '방금 찍은 사진을 안전하게 받았어요.'],
  ['증서 만드는 중', '사진과 이름을 오늘의 참가 증서에 담아요.'],
  ['굽는 중', '공개된 기록으로 남겨 누구나 확인할 수 있게 해요.'],
  ['진열 완료', '앞 화면 7번 칸에 당신의 증서가 놓였어요.'],
] as const;

export const PROCESS_DONE = PROCESS_STEPS.length;
