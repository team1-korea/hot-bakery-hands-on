import { createHash } from 'node:crypto';

import {
  PrivyClient,
  isEmbeddedWalletLinkedAccount,
  type EmbeddedWalletLinkedAccount,
  type LinkedAccount,
} from '@privy-io/node';

/**
 * 참가자 인증 이음매.
 *
 * - 로컬 개발: Privy 설정이 없으면 안정적인 목 DID/지갑을 만든다.
 * - 운영: Privy access token을 공식 SDK로 검증한 뒤 Users API에서 embedded EOA를 찾는다.
 *
 * 클라이언트가 보낸 지갑 주소는 절대 받지 않는다.
 */

export type Caller = {
  /** Privy DID. 참가자를 식별하는 유일한 키다. */
  did: string;
  /** Privy embedded EOA. DB unique 제약과 맞추기 위해 소문자로 정규화한다. */
  walletAddress: string;
};

export class WalletNotFoundError extends Error {
  constructor() {
    super('Privy embedded Ethereum wallet을 찾을 수 없습니다.');
    this.name = 'WalletNotFoundError';
  }
}

type VerifiedToken = { user_id: string };
type PrivyUser = { id: string; linked_accounts: LinkedAccount[] };
type EmbeddedEthereumWallet = Extract<EmbeddedWalletLinkedAccount, { chain_type: 'ethereum' }>;

/** 테스트에서 네트워크 없이 인증 경계를 검증하기 위한 최소 인터페이스. */
export type PrivyGateway = {
  verifyAccessToken(token: string): Promise<VerifiedToken>;
  getUser(did: string): Promise<PrivyUser>;
};

/** 브라우저 여러 개를 흉내낼 때 쓰는 개발 전용 식별자. */
const DEV_HEADER = 'x-dev-participant';
const DEV_COOKIE = 'bakery_dev_participant';
const EVM_ADDRESS = /^0x[0-9a-fA-F]{40}$/;

let configuredGateway: PrivyGateway | null = null;

function appId(): string | null {
  return process.env.PRIVY_APP_ID?.trim() || process.env.NEXT_PUBLIC_PRIVY_APP_ID?.trim() || null;
}

function gateway(): PrivyGateway | null {
  const id = appId();
  const secret = process.env.PRIVY_APP_SECRET?.trim();
  if (!id || !secret) return null;
  if (configuredGateway) return configuredGateway;

  const client = new PrivyClient({ appId: id, appSecret: secret });
  configuredGateway = {
    verifyAccessToken: (token) => client.utils().auth().verifyAccessToken(token),
    getUser: (did) => client.users()._get(did),
  };
  return configuredGateway;
}

/**
 * 요청에서 참가자를 알아낸다. 유효하지 않은/없는 토큰은 null이다.
 *
 * Privy 설정이 일부만 있으면 목으로 열지 않고 잠긴다. 운영(`NODE_ENV=production`)에서는
 * 설정이 통째로 빠져도 목 인증을 켜지 않는다. 배포 환경변수 실수로 모든 사용자가 한 사람으로
 * 합쳐지는 것을 막기 위해서다.
 */
export async function callerFrom(request: Request): Promise<Caller | null> {
  const configured = Boolean(appId() || process.env.PRIVY_APP_SECRET?.trim());
  if (configured) {
    const client = gateway();
    if (!client) return null;
    return callerFromPrivy(request, client);
  }

  if (process.env.NODE_ENV === 'production') return null;
  return mockCaller(devIdentity(request));
}

/**
 * 이미 등록된 참가자의 요청을 인증하고 DID만 돌려준다.
 *
 * `GET /api/entries`는 3초마다 호출된다. 여기서 매번 Privy Users API까지 조회하면 공식 문서가
 * "heavily rate limited"라고 경고하는 엔드포인트를 행사 내내 두드리게 된다. 지갑 주소는 최초
 * 등록에서 이미 DB에 저장했으므로, 이후 요청은 서명 검증으로 얻은 DID만 있으면 충분하다.
 */
export async function didFrom(request: Request): Promise<string | null> {
  const configured = Boolean(appId() || process.env.PRIVY_APP_SECRET?.trim());
  if (configured) {
    const client = gateway();
    if (!client) return null;
    return didFromPrivy(request, client);
  }

  if (process.env.NODE_ENV === 'production') return null;
  return mockCaller(devIdentity(request)).did;
}

/** access token의 서명·만료·앱 ID를 검증해 DID를 얻는다. */
export async function didFromPrivy(
  request: Request,
  client: Pick<PrivyGateway, 'verifyAccessToken'>,
): Promise<string | null> {
  const token = bearerToken(request.headers.get('authorization'));
  if (!token) return null;

  try {
    return (await client.verifyAccessToken(token)).user_id;
  } catch {
    return null;
  }
}

/** 공식 SDK를 감싼 실제 인증 로직. 검증 실패는 정보를 노출하지 않고 null로 합친다. */
export async function callerFromPrivy(
  request: Request,
  client: PrivyGateway,
): Promise<Caller | null> {
  const did = await didFromPrivy(request, client);
  if (!did) return null;

  try {
    // `_get`은 이름과 달리 @privy-io/node 0.29와 공식 문서가 제공하는 DID 조회 메서드다.
    const user = await client.getUser(did);
    // 요청 경로와 응답이 어긋나면 다른 사용자의 지갑으로 민팅할 수 있으므로 잠근다.
    if (user.id !== did) return null;

    const wallets = user.linked_accounts.filter((account): account is EmbeddedEthereumWallet => (
      isEmbeddedWalletLinkedAccount(account) &&
      account.chain_type === 'ethereum' &&
      EVM_ADDRESS.test(account.address)
    ));
    // 한 사용자에게 여러 embedded EVM 지갑이 있어도 API 배열 순서에 따라 recipient가 바뀌지 않게 한다.
    const wallet = wallets.sort((left, right) => left.wallet_index - right.wallet_index)[0];

    if (!wallet) throw new WalletNotFoundError();
    return { did, walletAddress: wallet.address.toLowerCase() };
  } catch (error) {
    if (error instanceof WalletNotFoundError) throw error;
    return null;
  }
}

function bearerToken(header: string | null): string | null {
  const match = header?.match(/^Bearer\s+([^\s]+)$/i);
  return match?.[1] ?? null;
}

/** 같은 이름이면 새로고침 뒤에도 같은 목 DID와 지갑 주소가 나온다. */
function mockCaller(identity: string): Caller {
  const digest = createHash('sha256').update(`bakery-dev:${identity}`).digest('hex');
  return {
    did: `did:privy:dev-${digest.slice(0, 16)}`,
    walletAddress: `0x${digest.slice(0, 40)}`,
  };
}

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
