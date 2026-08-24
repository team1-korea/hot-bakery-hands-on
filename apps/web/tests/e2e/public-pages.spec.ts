import { expect, test, type Page } from '@playwright/test';
import path from 'node:path';

import type { Entry, StateResponse } from '../../lib/api/types';

function captureRuntimeErrors(page: Page) {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  return errors;
}

test('참가자는 닉네임 입력 단계에 도달한다', async ({ page }) => {
  const errors = captureRuntimeErrors(page);

  await page.goto('/join');

  await expect(page.getByRole('heading', { name: /닉네임을 정해 주세요/ })).toBeVisible();
  await expect(page.getByRole('textbox', { name: /닉네임/ })).toBeVisible();
  await expect(page.getByRole('button', { name: '다음' })).toBeDisabled();
  expect(errors).toEqual([]);
});

test('TV 공개 화면의 세 구역과 참가 QR을 표시한다', async ({ page }) => {
  const errors = captureRuntimeErrors(page);

  await page.goto('/display');

  await expect(page.getByRole('heading', { name: '오븐 대기' })).toBeVisible();
  await expect(page.getByRole('heading', { name: '증서 오븐' })).toBeVisible();
  await expect(page.getByRole('heading', { name: '오늘의 진열장' })).toBeVisible();
  await expect(page.getByLabel('참가 페이지 QR 코드')).toBeVisible();
  expect(errors).toEqual([]);
});

function entry(nickname: string, status: Entry['status']): Entry {
  const submitted = status !== 'JOINED';
  const minted = status === 'MINTED';
  return {
    id: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
    nickname,
    status,
    photoUrl: submitted ? '/cookie.png' : null,
    tokenId: minted ? '7' : null,
    txHash: minted ? '0x1234' : null,
    shelfIndex: submitted ? 0 : null,
    hidden: false,
    failureReason: null,
    submittedAt: '2026-08-23T00:00:00.000Z',
  };
}

function state(entries: Entry[]): StateResponse {
  return {
    entries,
    show: { layout: 'LIVE', qrVisible: true, shelfPage: 0 },
    counts: {
      submitted: entries.filter((item) => item.shelfIndex !== null).length,
      minted: entries.filter((item) => item.status === 'MINTED').length,
    },
  };
}

test('참가자는 사진을 합성해 제출하고 발행 완료까지 복원한다', async ({ page }, testInfo) => {
  const errors = captureRuntimeErrors(page);
  const nickname = `쿠키-${testInfo.project.name}`.slice(0, 12);
  let current: Entry | null = null;
  let resultPolls = 0;
  await page.route('**/api/state', (route) => route.fulfill({ json: state([]) }));
  await page.route('**/api/participants', (route) => {
    current = entry(nickname, 'JOINED');
    return route.fulfill({ status: 201, json: current });
  });
  await page.route('**/api/entries', (route) => {
    if (route.request().method() === 'POST') {
      current = entry(nickname, 'SUBMITTED');
      return route.fulfill({ status: 201, json: current });
    }
    if (current?.status === 'SUBMITTED' && ++resultPolls >= 2) current = entry(nickname, 'MINTED');
    return route.fulfill({ json: current });
  });
  await page.goto('/join');

  await page.getByRole('textbox', { name: /닉네임/ }).fill(nickname);
  await page.getByRole('button', { name: '다음' }).click();
  await expect(page.getByRole('heading', { name: /쿠키 사진을/ })).toBeVisible();

  await page.locator('input[type="file"]').nth(1).setInputFiles(path.resolve('cookie.png'));
  await expect(page.getByAltText('맞추는 중인 쿠키 사진')).toBeVisible();
  await page.getByRole('button', { name: '다음' }).click();

  await expect(page.getByRole('heading', { name: /이 사진으로/ })).toBeVisible();
  await expect(page.getByText(/행사 종료 30일 후 내려가지만/)).toBeVisible();
  await page.getByRole('button', { name: '이 사진으로 발행하기' }).click();

  await expect(page.getByRole('heading', { name: /쿠키를 굽고 있어요/ })).toBeVisible();
  await expect(page.getByRole('heading', { name: '완성됐어요' })).toBeVisible({ timeout: 12_000 });
  expect(errors).toEqual([]);
});

test('TV는 첫 응답의 제출 카드를 오븐에 놓고 진열장까지 이동시킨다', async ({ page }, testInfo) => {
  const errors = captureRuntimeErrors(page);
  const nickname = `오븐-${testInfo.project.name}`.slice(0, 12);
  let polls = 0;
  await page.route('**/api/state', (route) => {
    polls += 1;
    const current = polls < 3 ? entry(nickname, 'SUBMITTED') : entry(nickname, 'MINTED');
    return route.fulfill({ json: state([current]) });
  });

  await page.goto('/display');
  await expect(page.locator('.oven').getByText(nickname)).toBeVisible();
  await expect(page.locator('.workbench').getByText(nickname)).toHaveCount(0);
  await expect(page.locator('.showcase').getByText(nickname)).toBeVisible({ timeout: 15_000 });
  expect(errors).toEqual([]);
});

test('TV 진열장에서 교육 슬라이드로 전환해 끝까지 진행한다', async ({ page }) => {
  const errors = captureRuntimeErrors(page);
  const minted = entry('쿠키선생', 'MINTED');
  await page.route('**/api/state', (route) => route.fulfill({
    json: {
      ...state([minted]),
      show: { layout: 'GALLERY', qrVisible: false, shelfPage: 0 },
    },
  }));

  await page.goto('/display');

  await page.getByRole('button', { name: 'NFT 교육 세션으로 이동' }).click();
  await expect(page.getByRole('heading', { name: '방금, 쿠키가 NFT가 되었습니다' })).toBeVisible();

  await page.keyboard.press('ArrowRight');
  await expect(page.getByRole('heading', { name: 'NFT 한 장은 세 겹으로 이루어집니다' })).toBeVisible();

  await page.keyboard.press('End');
  await expect(page.getByRole('heading', { name: 'C-Chain에는 소유와 발행 기록이 남습니다' })).toBeVisible();
  await page.getByRole('button', { name: '진열장으로 돌아가기' }).click();

  await expect(page.getByRole('heading', { name: '오늘의 진열장' })).toBeVisible();
  expect(errors).toEqual([]);
});
