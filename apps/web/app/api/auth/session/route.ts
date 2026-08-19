import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

import type { Session } from '@/lib/api/types';
import { SESSION_COOKIE, fail } from '@/lib/server/http';
import { findParticipant } from '@/lib/server/store';

export async function GET() {
  const participantId = (await cookies()).get(SESSION_COOKIE)?.value;
  const participant = participantId ? findParticipant(participantId) : null;
  if (!participantId || !participant) return fail('UNAUTHENTICATED', '다시 로그인해 주세요.');

  return NextResponse.json<Session>({ participantId, email: participant.email });
}
