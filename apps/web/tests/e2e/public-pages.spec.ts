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
  await page.route('https://certificate-frame.test/nft-design.jpg', (route) => route.fulfill({
    path: path.resolve('tests/fixtures/certificate-frame.jpg'),
    contentType: 'image/jpeg',
    headers: { 'Access-Control-Allow-Origin': '*' },
  }));
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
  const frameResponse = page.waitForResponse((response) => (
    response.url() === 'https://certificate-frame.test/nft-design.jpg'
  ));
  const fontResponse = page.waitForResponse((response) => (
    new URL(response.url()).pathname === '/assets/fonts/pretendard-bold.woff2'
  ));
  await page.getByRole('button', { name: '다음' }).click();

  expect((await frameResponse).ok()).toBe(true);
  expect((await fontResponse).ok()).toBe(true);
  await expect(page.getByRole('heading', { name: /이 사진으로/ })).toBeVisible();
  const certificatePreview = page.getByAltText('발행될 참가증서');
  await expect(certificatePreview).toBeVisible();
  await expect.poll(() => certificatePreview.evaluate((image: HTMLImageElement) => (
    [image.naturalWidth, image.naturalHeight]
  ))).toEqual([1080, 1440]);
  await expect(certificatePreview).toHaveCSS('object-fit', 'contain');
  const certificateFile = await certificatePreview.evaluate(async (image: HTMLImageElement) => {
    const blob = await fetch(image.src).then((response) => response.blob());
    return { size: blob.size, type: blob.type };
  });
  expect(certificateFile.type).toBe('image/jpeg');
  expect(certificateFile.size).toBeLessThan(4 * 1024 * 1024);
  const certificatePixels = await certificatePreview.evaluate(async (image: HTMLImageElement) => {
    const canvas = document.createElement('canvas');
    canvas.width = image.naturalWidth;
    canvas.height = image.naturalHeight;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('canvas context unavailable');
    context.drawImage(image, 0, 0);

    const guidePoints = [
      [334, 799],
      [744, 799],
      [539, 594],
      [539, 1004],
    ];
    const guideColors = guidePoints.map(([x, y]) => (
      [...context.getImageData(x, y, 1, 1).data.slice(0, 3)]
    ));

    const nameRegion = context.getImageData(200, 1020, 680, 120).data;
    let nameRedPixels = 0;
    for (let index = 0; index < nameRegion.length; index += 4) {
      const [red, green, blue] = nameRegion.slice(index, index + 3);
      if (red > 150 && green < 90 && blue < 100 && red > green * 2) nameRedPixels += 1;
    }
    return { guideColors, nameRedPixels };
  });
  const designRed = [0xda, 0x24, 0x2d];
  for (const pixel of certificatePixels.guideColors) {
    const distance = Math.hypot(...pixel.map((channel, index) => channel - designRed[index]));
    expect(distance).toBeGreaterThan(50);
  }
  expect(certificatePixels.nameRedPixels).toBeGreaterThan(100);
  await expect(page.getByText(/행사 종료 30일 후 내려가지만/)).toBeVisible();
  await page.getByRole('button', { name: '이 사진으로 발행하기' }).click();

  await expect(page.getByRole('heading', { name: /쿠키를 굽고 있어요/ })).toBeVisible();
  await expect(page.getByRole('heading', { name: '완성됐어요' })).toBeVisible({ timeout: 12_000 });
  expect(errors).toEqual([]);
});

test('TV는 첫 응답의 제출 카드를 오븐에 놓고 진열장까지 이동시킨다', async ({ page }, testInfo) => {
  const errors = captureRuntimeErrors(page);
  const nickname = `오븐-${testInfo.project.name}`.slice(0, 12);
  const minted = entry(nickname, 'MINTED');
  let polls = 0;
  await page.route('**/cookie.png', (route) => route.fulfill({
    path: path.resolve('cookie.png'),
    contentType: 'image/png',
  }));
  await page.route('**/api/state', (route) => {
    polls += 1;
    const current = polls < 3 ? entry(nickname, 'SUBMITTED') : minted;
    return route.fulfill({ json: state([current]) });
  });

  await page.goto('/display');
  await expect(page.locator('.oven').getByText(nickname)).toBeVisible();
  await expect(page.locator('.oven img')).toHaveCSS('object-fit', 'contain');
  await expect(page.locator('.workbench').getByText(nickname)).toHaveCount(0);
  await expect(page.locator('.showcase').getByRole('img', { name: `${nickname}의 참가증서` }))
    .toBeVisible({ timeout: 15_000 });
  await expect(page.locator('.showcase img')).toHaveCSS('object-fit', 'contain');
  const caption = page.locator('.showcase .certificate-card .certificate-caption');
  await expect(caption).toHaveCount(1);
  await expect(caption).toHaveCSS('flex-direction', 'row');
  await expect(caption.getByText(`#${minted.tokenId}`)).toBeVisible();
  await expect(caption.getByText(nickname)).toBeVisible();
  await expect.poll(async () => {
    const cardBox = await page.locator('.showcase .certificate-card').boundingBox();
    const mediaBox = await page.locator('.showcase .certificate-card .card-media').boundingBox();
    return (mediaBox?.height ?? 0) / (cardBox?.height ?? 1);
  }).toBeGreaterThan(0.83);
  expect(errors).toEqual([]);
});

test('TV 진열장에서 교육 슬라이드로 전환해 끝까지 진행한다', async ({ page }) => {
  const errors = captureRuntimeErrors(page);
  const minted = entry('쿠키선생', 'MINTED');
  await page.route('**/cookie.png', (route) => route.fulfill({
    path: path.resolve('cookie.png'),
    contentType: 'image/png',
  }));
  await page.route('**/api/state', (route) => route.fulfill({
    json: state([minted]),
  }));

  await page.goto('/display');

  await expect(page.getByRole('heading', { name: '증서 오븐' })).toBeVisible();
  await expect(page.locator('.showcase img')).toBeVisible();
  await expect.poll(async () => {
    const cardBox = await page.locator('.shelf-card-frame').boundingBox();
    return (cardBox?.width ?? 0) / (cardBox?.height ?? 1);
  }).toBeCloseTo(3 / 4, 2);
  await expect.poll(async () => {
    const cardBox = await page.locator('.showcase .cookie-card').boundingBox();
    const mediaBox = await page.locator('.showcase .card-media').boundingBox();
    return (mediaBox?.height ?? 0) / (cardBox?.height ?? 1);
  }).toBeGreaterThan(0.83);
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
