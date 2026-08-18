export type JoinVariantId = 'a' | 'b';

/**
 * 참가자 화면 A안 / B안의 단일 출처.
 * 데모 설정 화면과 참가자 화면 고르기가 같은 문구를 쓴다.
 */
export const JOIN_VARIANTS = [
  {
    id: 'a',
    title: '앞 화면에 집중',
    copy: '제출이 끝나면 휴대폰은 멈추고, 굽고 진열되는 과정은 TV에서 보여줘요.',
    href: '/join/a',
    afterSubmit: [
      '휴대폰은 “고개를 들어 앞 화면을 보세요” 한 장에서 멈춰요.',
      '내 자리 칸 번호만 알려주고 더 누를 것이 없어요.',
      '굽고 진열되는 과정은 전부 TV에서 봐요.',
    ],
  },
  {
    id: 'b',
    title: '휴대폰에서 단계 확인',
    copy: '휴대폰에 네 단계를 보여주고, TV도 같은 처리 흐름을 따라가요.',
    href: '/join/b',
    afterSubmit: [
      '사진 저장 → 증서 만들기 → 굽기 → 진열, 네 단계가 순서대로 켜져요.',
      '만들어지는 증서를 휴대폰에서 바로 열어볼 수 있어요.',
      'TV는 같은 흐름을 크게 보여주는 역할이에요.',
    ],
  },
] as const;

export const JOIN_VARIANT_LABEL: Record<JoinVariantId, string> = {
  a: 'A안 · 앞 화면에 집중',
  b: 'B안 · 휴대폰에서 단계 확인',
};
