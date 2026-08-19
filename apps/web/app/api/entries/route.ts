import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

import type { Entry } from '@/lib/api/types';
import { SESSION_COOKIE, fail } from '@/lib/server/http';
import { createEntry, findEntryById, findParticipant, isFull } from '@/lib/server/store';

const MAX_PHOTO_BYTES = 4 * 1024 * 1024;
const ALLOWED = new Set(['image/jpeg', 'image/png', 'image/webp']);

export async function POST(request: Request) {
  const participantId = (await cookies()).get(SESSION_COOKIE)?.value;
  const participant = participantId ? findParticipant(participantId) : null;
  if (!participantId || !participant) return fail('UNAUTHENTICATED', '다시 로그인해 주세요.');
  if (participant.entryId) return fail('ALREADY_SUBMITTED', '이미 사진을 보냈어요.');
  if (isFull()) return fail('SHOWCASE_FULL', '오늘 진열장이 다 찼어요. 운영자에게 말씀해 주세요.');

  const form = await request.formData();
  const nickname = String(form.get('nickname') ?? '').trim();
  const photo = form.get('photo');

  if (!nickname || nickname.length > 12) {
    return fail('INVALID_NICKNAME', '이름은 1~12자로 적어 주세요.');
  }
  if (!(photo instanceof File) || photo.size === 0) {
    return fail('INVALID_PHOTO', '쿠키 사진을 선택해 주세요.');
  }
  if (!ALLOWED.has(photo.type)) {
    return fail('INVALID_PHOTO', 'JPG, PNG, WebP 사진만 보낼 수 있어요.');
  }
  if (photo.size > MAX_PHOTO_BYTES) {
    return fail('INVALID_PHOTO', '사진이 너무 커요. 다시 찍어 주세요.');
  }

  const entry = createEntry({
    participantId,
    nickname,
    photo: {
      bytes: new Uint8Array(await photo.arrayBuffer()),
      contentType: photo.type,
    },
  });

  return NextResponse.json<Entry>(entry, { status: 201 });
}

export async function GET() {
  const participantId = (await cookies()).get(SESSION_COOKIE)?.value;
  const participant = participantId ? findParticipant(participantId) : null;
  if (!participantId || !participant) return fail('UNAUTHENTICATED', '다시 로그인해 주세요.');

  const entry = participant.entryId ? findEntryById(participant.entryId) : null;
  return NextResponse.json<Entry | null>(entry);
}
