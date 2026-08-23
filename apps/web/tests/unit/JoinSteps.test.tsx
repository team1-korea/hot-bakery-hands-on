import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, test, vi } from 'vitest';

import { NicknameStep, ReviewStep } from '@/app/join/JoinSteps';

describe('참가자 입력 단계', () => {
  test('빈 닉네임으로는 다음 단계로 갈 수 없다', () => {
    render(
      <NicknameStep
        nickname=""
        error={null}
        busy={false}
        onNickname={() => {}}
        onNext={() => {}}
      />,
    );

    expect(screen.getByRole('button', { name: '다음' })).toBeDisabled();
  });

  test('닉네임이 있으면 다음 동작을 호출한다', () => {
    const onNext = vi.fn();
    render(
      <NicknameStep
        nickname="쿠키왕"
        error={null}
        busy={false}
        onNickname={() => {}}
        onNext={onNext}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: '다음' }));

    expect(onNext).toHaveBeenCalledOnce();
  });

  test('발행 전에 공개와 되돌릴 수 없음을 알린다', () => {
    render(
      <ReviewStep
        nickname="쿠키왕"
        previewUrl={null}
        error={null}
        busy={false}
        onSubmit={() => {}}
        onBack={() => {}}
      />,
    );

    expect(screen.getByText(/발행하면 되돌릴 수 없어요/)).toBeVisible();
    expect(screen.getByText(/블록체인에 공개로 영원히 남습니다/)).toBeVisible();
    expect(screen.getByText(/행사 종료 30일 후 내려가지만/)).toBeVisible();
  });
});
