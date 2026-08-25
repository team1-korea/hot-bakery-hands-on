import type { Photo } from './storage';

const PINATA_BASE_URL = 'https://api.pinata.cloud';
/**
 * 핀 한 번의 상한. 증서는 1080×1440 JPEG(품질 0.82)이라 수백 KB이고 실제로는 몇 초면
 * 끝난다. 이보다 오래 걸리는 핀은 사진 핀과 메타데이터 핀을 더해 `maxDuration = 60`을
 * 넘기고, 그러면 인보케이션이 죽어 행이 중간 상태로 남는다. **일찍 포기해 FAILED로
 * 만드는 편이 낫다** — 실패는 운영자가 다시 시도로 풀 수 있지만 멈춤은 풀 수 없다.
 */
const REQUEST_TIMEOUT_MS = 12_000;

type FetchLike = typeof fetch;

type PinataResponse = {
  IpfsHash?: string;
};

export type CertificateMetadata = {
  name: string;
  description: string;
  image: `ipfs://${string}`;
  attributes: Array<
    | { trait_type: string; value: string }
    | { trait_type: string; display_type: 'date'; value: number }
  >;
};

/**
 * Pinata Pinning API를 감싼다. JWT는 요청을 보낼 때만 읽어서,
 * 모듈 import만으로는 프론트 목 환경이 깨지지 않는다.
 */
export class PinataClient {
  constructor(
    private readonly jwt: string,
    private readonly fetchImpl: FetchLike = fetch,
    private readonly baseUrl: string = PINATA_BASE_URL,
  ) {}

  async pinFile(photo: Photo, name: string): Promise<string> {
    const form = new FormData();
    form.set('file', new Blob([photo.bytes as BlobPart], { type: photo.contentType }), name);
    form.set('pinataMetadata', JSON.stringify({ name }));
    form.set('pinataOptions', JSON.stringify({ cidVersion: 1 }));

    return this.pin('/pinning/pinFileToIPFS', {
      method: 'POST',
      body: form,
    });
  }

  async pinJson(metadata: CertificateMetadata, name: string): Promise<string> {
    return this.pin('/pinning/pinJSONToIPFS', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        pinataContent: metadata,
        pinataMetadata: { name },
        pinataOptions: { cidVersion: 1 },
      }),
    });
  }

  /** 라이브 검증이 남긴 테스트 핀을 정리할 때만 쓴다. */
  async unpin(cid: string): Promise<void> {
    const response = await this.fetchImpl(`${this.baseUrl}/pinning/unpin/${encodeURIComponent(cid)}`, {
      method: 'DELETE',
      headers: this.authorization(),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    if (!response.ok && response.status !== 404) {
      throw new Error(`Pinata unpin 실패 (${response.status}): ${await safeText(response)}`);
    }
  }

  private async pin(path: string, init: RequestInit): Promise<string> {
    const response = await this.fetchImpl(`${this.baseUrl}${path}`, {
      ...init,
      headers: { ...this.authorization(), ...(init.headers ?? {}) },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    if (!response.ok) {
      throw new Error(`Pinata 핀 실패 (${response.status}): ${await safeText(response)}`);
    }

    const body = (await response.json()) as PinataResponse;
    if (!body.IpfsHash) throw new Error('Pinata 응답에 IpfsHash가 없습니다.');
    return body.IpfsHash;
  }

  private authorization() {
    if (!this.jwt) throw new Error('PINATA_JWT가 없습니다.');
    return { authorization: `Bearer ${this.jwt}` };
  }
}

export function pinataFromEnv(): PinataClient {
  return new PinataClient(process.env.PINATA_JWT ?? '');
}

export function buildCertificateMetadata(input: {
  nickname: string;
  certificateCid: string;
  submittedAt: Date;
}): CertificateMetadata {
  return {
    name: `Avalanche Bakery 참가 증서 — ${input.nickname}`,
    description: `2026년 8월 쿠키 클래스에서 ${input.nickname}이 구운 쿠키의 참가 증서입니다.`,
    image: `ipfs://${input.certificateCid}`,
    attributes: [
      { trait_type: '닉네임', value: input.nickname },
      { trait_type: '행사', value: 'Avalanche Bakery' },
      {
        trait_type: '발행일',
        display_type: 'date',
        value: Math.floor(input.submittedAt.getTime() / 1_000),
      },
    ],
  };
}

function safeText(response: Response): Promise<string> {
  return response.text().then((text) => text.slice(0, 500)).catch(() => '');
}
