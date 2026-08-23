import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import { ApiError } from '@/lib/api/client';
import type { Entry, StateResponse } from '@/lib/api/types';

const api = vi.hoisted(() => ({
  getMyEntry: vi.fn(),
  getState: vi.fn(),
  registerParticipant: vi.fn(),
  submitEntry: vi.fn(),
}));
const privy = vi.hoisted(() => ({
  login: vi.fn(),
  ready: true,
  authenticated: true,
}));

vi.mock('@/lib/api/client', () => ({
  ...api,
  ApiError: class ApiError extends Error {
    constructor(readonly code: string, message: string) {
      super(message);
    }
  },
  setAuthTokenGetter: vi.fn(),
}));
vi.mock('@/app/join/PrivyClientProvider', () => ({ PRIVY_ENABLED: true }));
vi.mock('@/app/join/usePrivyLogin', () => ({ usePrivyLogin: () => privy }));

import { JoinFlow } from '@/app/join/JoinFlow';

const MINTED_ENTRY: Entry = {
  id: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
  nickname: '서버닉네임',
  status: 'MINTED',
  photoUrl: '/api/photos/aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
  tokenId: '7',
  txHash: '0x1234',
  shelfIndex: 0,
  hidden: false,
  failureReason: null,
  submittedAt: '2026-08-23T00:00:00.000Z',
};
const SUBMITTED_ENTRY: Entry = {
  ...MINTED_ENTRY,
  status: 'SUBMITTED',
  tokenId: null,
  txHash: null,
};

const STATE: StateResponse = {
  entries: [],
  show: { layout: 'LIVE', qrVisible: true, shelfPage: 0 },
  counts: { submitted: 0, minted: 0 },
};
const FULL_STATE: StateResponse = {
  ...STATE,
  counts: { submitted: 30, minted: 30 },
};

beforeEach(() => {
  privy.login.mockResolvedValue(undefined);
  privy.ready = true;
  privy.authenticated = true;
  api.getMyEntry.mockResolvedValue(null);
  api.getState.mockResolvedValue(STATE);
  api.registerParticipant.mockResolvedValue(MINTED_ENTRY);
});

afterEach(() => {
  vi.useRealTimers();
});

describe('참가자 기록 복원', () => {
  test('재등록 응답이 기존 제출 항목이면 사진 단계로 보내지 않고 결과를 복원한다', async () => {
    render(<JoinFlow isMockServer />);

    const nickname = await screen.findByRole('textbox', { name: /닉네임/ });
    fireEvent.change(nickname, { target: { value: '새로 입력한 이름' } });
    fireEvent.click(screen.getByRole('button', { name: '다음' }));

    expect(await screen.findByRole('heading', { name: '완성됐어요' })).toBeVisible();
    expect(screen.getByText('서버닉네임')).toBeVisible();
  });

  test('진열장이 가득 차도 로그인한 기존 참가자는 결과를 복원한다', async () => {
    privy.authenticated = false;
    api.getState.mockResolvedValue(FULL_STATE);
    api.getMyEntry.mockResolvedValue(MINTED_ENTRY);

    render(<JoinFlow isMockServer />);

    const login = await screen.findByRole('button', { name: 'Google로 시작하기' });
    expect(screen.queryByRole('heading', { name: /자리가.*찼어요/ })).not.toBeInTheDocument();
    fireEvent.click(login);

    expect(await screen.findByRole('heading', { name: '완성됐어요' })).toBeVisible();
    expect(privy.login).toHaveBeenCalledOnce();
  });

  test('초기 참가 기록 조회에서 인증이 만료되면 로그인 화면으로 돌아간다', async () => {
    api.getMyEntry.mockRejectedValueOnce(new ApiError('UNAUTHENTICATED', '다시 로그인해 주세요.'));

    render(<JoinFlow isMockServer />);

    expect(await screen.findByRole('button', { name: 'Google로 시작하기' })).toBeVisible();
  });

  test('제출 결과를 확인하던 중 인증이 만료되면 로그인 화면으로 돌아간다', async () => {
    vi.useFakeTimers();
    api.getMyEntry
      .mockResolvedValueOnce(SUBMITTED_ENTRY)
      .mockRejectedValueOnce(new ApiError('UNAUTHENTICATED', '다시 로그인해 주세요.'));

    render(<JoinFlow isMockServer />);
    await act(async () => {});
    expect(screen.getByRole('heading', { name: /쿠키를.*굽고 있어요/ })).toBeVisible();

    await act(async () => {
      vi.advanceTimersByTime(3_000);
      await Promise.resolve();
    });

    expect(screen.getByRole('button', { name: 'Google로 시작하기' })).toBeVisible();
  });
});
