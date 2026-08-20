import { createHash } from 'node:crypto';

/**
 * 참가자 인증 이음매.
 *
 * 라우트는 여기만 부르고 Privy를 직접 알지 못한다. `PRIVY_APP_ID`가 생기면 이 파일
 * 하나만 바꾸면 되고 라우트는 그대로다 — AGENTS.md의 "없으면 목, 있으면 실제" 구조다.
 */

export type Caller = {
  /** Privy DID. 참가자를 식별하는 유일한 키다. */
  did: string;
  /** Privy 임베디드 EOA. 소문자로 정규화한다(db/schema.sql의 unique 제약과 같은 이유). */
  walletAddress: string;
};

/**
 * 목 인증에서 참가자를 가르는 값을 어디서 읽을지.
 *
 * 프론트가 폰 여러 대를 흉내내야 하므로 헤더로 갈아끼울 수 있어야 하고, 브라우저에서
 * 직접 눌러 볼 때는 헤더를 붙일 수 없으니 쿠키로도 받는다. 둘 다 없으면 한 사람으로 친다.
 */
const DEV_HEADER = 'x-dev-participant';
const DEV_COOKIE = 'bakery_dev_participant';

/**
 * 요청에서 참가자를 알아낸다. 알 수 없으면 null이고, 라우트가 401로 바꾼다.
 *
 * **`PRIVY_APP_ID`가 있으면 아직 아무도 통과하지 못한다.** Privy 앱이 만들어지기 전이라
 * 토큰을 검증할 방법이 없고, 검증 없이 통과시키면 아무나 남의 DID를 사칭할 수 있다.
 * 설정이 반쯤 된 상태에서는 열리는 쪽이 아니라 잠기는 쪽으로 실패한다.
 */
export async function callerFrom(request: Request): Promise<Caller | null> {
  if (process.env.PRIVY_APP_ID) {
    // TODO(Privy): access token 검증 → DID, 그리고 Privy Users API로 embedded EOA 조회.
    return null;
  }
  return mockCaller(devIdentity(request));
}

/**
 * 같은 이름이면 항상 같은 DID와 지갑 주소가 나온다. 프론트가 폴링을 하다 새로고침해도
 * 같은 사람으로 붙어야 카드가 두 장 생기지 않는다.
 */
function mockCaller(identity: string): Caller {
  const digest = createHash('sha256').update(`bakery-dev:${identity}`).digest('hex');
  return {
    did: `did:privy:dev-${digest.slice(0, 16)}`,
    walletAddress: `0x${digest.slice(0, 40)}`,
  };
}

/**
 * `Authorization` 헤더는 일부러 보지 않는다. Privy access token은 로그인할 때마다 값이
 * 달라져서, 그걸로 신원을 만들면 같은 사람이 다시 로그인할 때마다 다른 참가자가 된다.
 */
function devIdentity(request: Request): string {
  const header = request.headers.get(DEV_HEADER)?.trim();
  if (header) return header;

  const cookie = readCookie(request.headers.get('cookie'), DEV_COOKIE);
  return cookie ?? 'dev-participant';
}

function readCookie(header: string | null, name: string): string | null {
  if (!header) return null;
  for (const part of header.split(';')) {
    const [key, ...rest] = part.trim().split('=');
    if (key === name) return decodeURIComponent(rest.join('=')) || null;
  }
  return null;
}
