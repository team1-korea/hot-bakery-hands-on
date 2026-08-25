'use client';

import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';

import { C_CHAIN } from '@/lib/explorer';

import { TopBar } from './TopBar';

type SessionSlideId =
  | 'opening'
  | 'anatomy'
  | 'storage'
  | 'wallet'
  | 'minting'
  | 'certificate'
  | 'chain';

export type SessionSlide = {
  id: SessionSlideId;
  title: string;
  lead: string;
};

export const SESSION_SLIDES: readonly SessionSlide[] = [
  {
    id: 'opening',
    title: '방금, 쿠키가 NFT가 되었습니다',
    lead: '진열장의 한 장은 사진 파일만도, 블록체인 기록만도 아닙니다.',
  },
  {
    id: 'anatomy',
    title: 'NFT 한 장은 세 겹으로 이루어집니다',
    lead: '우리가 보는 이미지, 그 이미지를 설명하는 메타데이터, 소유권을 기록한 토큰이 연결됩니다.',
  },
  {
    id: 'storage',
    title: '사진은 체인 안이 아니라 IPFS에 있습니다',
    lead: '블록체인에는 큰 이미지 파일 대신, 내용을 가리키는 짧은 주소가 기록됩니다.',
  },
  {
    id: 'wallet',
    title: 'Google 로그인 뒤, 내 지갑이 만들어졌습니다',
    lead: 'Privy가 로그인 계정과 연결된 임베디드 EVM 지갑을 만들고, 그 주소가 증서의 주인이 됩니다.',
  },
  {
    id: 'minting',
    title: '오븐 안에서는 다섯 단계가 지나갔습니다',
    lead: '합성본을 받은 서버가 이미지와 메타데이터를 고정하고, 한 명씩 체인에 발행했습니다.',
  },
  {
    id: 'certificate',
    title: '이번 참가증서는 팔 수 없는 NFT입니다',
    lead: 'ERC-721이라는 뼈대는 같지만, 소유권을 옮기지 못하도록 잠근 참여 증명입니다.',
  },
  {
    id: 'chain',
    title: 'C-Chain에는 소유와 발행 기록이 남습니다',
    lead: '누가 어떤 토큰을 받았는지, 무엇을 가리키는지, 어느 거래에서 발행됐는지 확인할 수 있습니다.',
  },
] as const;

export function SessionDeck({
  slide,
  stale,
  onSlide,
  onExit,
}: {
  slide: number;
  stale: boolean;
  onSlide: (slide: number) => void;
  onExit: () => void;
}) {
  const reduceMotion = useReducedMotion();
  const currentIndex = Math.min(Math.max(slide, 0), SESSION_SLIDES.length - 1);
  const current = SESSION_SLIDES[currentIndex];
  const last = currentIndex === SESSION_SLIDES.length - 1;

  return (
    <section className="session-deck" aria-label="NFT 교육 세션">
      <TopBar stale={stale} />

      <div className="session-stage">
        <AnimatePresence initial={false} mode="wait">
          <motion.article
            className={`session-slide session-slide--${current.id}`}
            key={current.id}
            role="group"
            aria-roledescription="슬라이드"
            aria-label={`${currentIndex + 1} / ${SESSION_SLIDES.length}`}
            initial={reduceMotion ? false : { x: 90, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={reduceMotion ? undefined : { x: -70, opacity: 0 }}
            transition={{ duration: reduceMotion ? 0 : 0.42, ease: [0.22, 1, 0.36, 1] }}
          >
            <SlideContent slide={current} />
          </motion.article>
        </AnimatePresence>
      </div>

      <nav className="session-navigation" aria-label="교육 슬라이드 이동">
        <button
          className="session-nav-button"
          type="button"
          disabled={currentIndex === 0}
          aria-label="이전 슬라이드"
          onClick={() => onSlide(currentIndex - 1)}
        >
          <Arrow direction="left" />
          이전
        </button>

        <div className="session-progress">
          {SESSION_SLIDES.map((item, index) => (
            <button
              key={item.id}
              type="button"
              data-current={index === currentIndex ? 'true' : undefined}
              aria-current={index === currentIndex ? 'step' : undefined}
              aria-label={`${index + 1}번 슬라이드: ${item.title}`}
              onClick={() => onSlide(index)}
            >
              <span>{index + 1}</span>
            </button>
          ))}
        </div>

        {last ? (
          <button className="session-nav-button is-exit" type="button" onClick={onExit}>
            진열장으로 돌아가기
          </button>
        ) : (
          <button
            className="session-nav-button"
            type="button"
            aria-label="다음 슬라이드"
            onClick={() => onSlide(currentIndex + 1)}
          >
            다음
            <Arrow direction="right" />
          </button>
        )}
      </nav>
    </section>
  );
}

function SlideContent({ slide }: { slide: SessionSlide }) {
  if (slide.id === 'opening') {
    return (
      <div className="session-opening">
        <h1 aria-label={slide.title}>방금, 쿠키가 <em>NFT</em>가 되었습니다</h1>
        <p>{slide.lead}</p>
      </div>
    );
  }

  return (
    <>
      <header className="session-slide-head">
        <h1>{slide.title}</h1>
        <p>{slide.lead}</p>
      </header>
      <div className="session-slide-body">
        {slide.id === 'anatomy' ? <AnatomySlide /> : null}
        {slide.id === 'storage' ? <StorageSlide /> : null}
        {slide.id === 'wallet' ? <WalletSlide /> : null}
        {slide.id === 'minting' ? <MintingSlide /> : null}
        {slide.id === 'certificate' ? <CertificateSlide /> : null}
        {slide.id === 'chain' ? <ChainSlide /> : null}
      </div>
    </>
  );
}

function AnatomySlide() {
  return (
    <ol className="session-layers">
      <li>
        <span>IMAGE</span>
        <div>
          <strong>완성된 증서 이미지</strong>
          <p>쿠키 사진에 프레임을 합성한, 눈에 보이는 한 장</p>
        </div>
        <code>certificate.jpg</code>
      </li>
      <li>
        <span>METADATA</span>
        <div>
          <strong>이름 · 설명 · 속성</strong>
          <p>닉네임, 행사, 발행일을 이미지 주소와 연결</p>
        </div>
        <code>image: ipfs://&lt;사진 CID&gt;</code>
      </li>
      <li>
        <span>TOKEN</span>
        <div>
          <strong>C-Chain의 소유 기록</strong>
          <p>누가 소유하고 어떤 메타데이터를 보는지 기록</p>
        </div>
        <code>ownerOf · tokenURI</code>
      </li>
    </ol>
  );
}

function StorageSlide() {
  return (
    <ol className="session-storage">
      <li>
        <span>1</span>
        <strong>브라우저</strong>
        <p>사진을 자르고 증서 프레임을 합성합니다.</p>
        <small>원본 사진은 서버로 보내지지 않음</small>
      </li>
      <li>
        <span>2</span>
        <strong>운영 저장소</strong>
        <p>최종 합성 증서 한 장을 행사 운영용으로 보관합니다.</p>
        <small>Supabase Storage · 행사 종료 30일 후 파기</small>
      </li>
      <li>
        <span>3</span>
        <strong>IPFS</strong>
        <p>이미지와 메타데이터에 내용 기반 CID가 생깁니다.</p>
        <code>ipfs://bafy…</code>
      </li>
      <li>
        <span>4</span>
        <strong>C-Chain</strong>
        <p>이미지 바이트 대신 메타데이터 CID를 기록합니다.</p>
        <small>체인에는 파일이 아닌 주소만 기록</small>
      </li>
    </ol>
  );
}

function WalletSlide() {
  return (
    <div className="session-wallet">
      <div className="wallet-path">
        <span>Google 로그인</span>
        <i aria-hidden="true" />
        <span>Privy</span>
        <i aria-hidden="true" />
        <strong>나의 지갑 <code>0x…</code></strong>
      </div>
      <div className="wallet-owner">
        <code>ownerOf(tokenId)</code>
        <span>=</span>
        <strong>참가자 지갑 주소</strong>
      </div>
      <dl className="wallet-roles">
        <div>
          <dt>Google 계정</dt>
          <dd>지갑을 여는 로그인 열쇠</dd>
        </div>
        <div>
          <dt>참가자 지갑</dt>
          <dd>NFT의 실제 소유 주소</dd>
        </div>
        <div>
          <dt>서버 민터</dt>
          <dd>발행만 하고 소유하지 않음</dd>
        </div>
      </dl>
    </div>
  );
}

function MintingSlide() {
  const steps = [
    ['합성본 제출', '브라우저가 완성한 증서 한 장'],
    ['IPFS 고정', '이미지와 메타데이터에 CID 생성'],
    ['mint 호출', '서버 민터가 참가자 주소로 발행'],
    ['체인 확인', '영수증과 CertificateIssued 이벤트 검증'],
    ['진열 완료', 'tokenId와 txHash를 저장하고 TV로 이동'],
  ] as const;

  return (
    <ol className="session-minting">
      {steps.map(([title, description], index) => (
        <li key={title}>
          <span>{index + 1}</span>
          <strong>{title}</strong>
          <p>{description}</p>
        </li>
      ))}
      <p className="minting-note">참가자마다 즉시 · 한 번에 한 명씩 직렬 발행</p>
    </ol>
  );
}

function CertificateSlide() {
  return (
    <div className="session-certificate">
      <div className="certificate-common">
        <strong>공통 기반</strong>
        <b>ERC-721</b>
        <p>tokenId · ownerOf · tokenURI · 공개된 체인 기록</p>
      </div>
      <div className="certificate-compare">
        <section>
          <strong>많은 NFT</strong>
          <p>소유자가 다른 지갑으로 보내거나 거래소에서 사고팔 수 있습니다.</p>
        </section>
        <section>
          <strong>이번 참가증서</strong>
          <p><b>EIP-5192 Locked</b> — 전송과 승인을 막은 소울바운드 참여 증명입니다.</p>
          <small>
            한 지갑에 한 장 · {C_CHAIN.testnet ? 'Fuji 테스트넷' : 'Avalanche 메인넷'} ·
            오발급은 소각 후 새 토큰으로 재발급
          </small>
        </section>
      </div>
    </div>
  );
}

function ChainSlide() {
  return (
    <div className="session-chain">
      <dl className="chain-ledger">
        <div><dt>NETWORK</dt><dd>{C_CHAIN.label} · {C_CHAIN.id}</dd></div>
        <div><dt>CONTRACT</dt><dd>Avalanche Bakery Certificate</dd></div>
        <div><dt>EVENT</dt><dd>CertificateIssued</dd></div>
        <div><dt>TOKEN</dt><dd>#&lt;tokenId&gt; → 0x&lt;참가자 지갑&gt;</dd></div>
        <div><dt>URI</dt><dd>ipfs://&lt;metadata CID&gt;</dd></div>
      </dl>
      <div className="chain-meaning">
        <strong>체인에 직접 넣지 않은 것</strong>
        <ul>
          <li>원본 쿠키 사진</li>
          <li>이미지 파일의 바이트</li>
          <li>참가자 지갑의 개인키</li>
        </ul>
        <p>트랜잭션 해시를 열면 이 발행과 이벤트를 Explorer에서 직접 확인할 수 있습니다.</p>
      </div>
    </div>
  );
}

function Arrow({ direction }: { direction: 'left' | 'right' }) {
  return (
    <svg viewBox="0 0 28 28" aria-hidden="true">
      <path
        d={direction === 'left' ? 'M18 4 8 14l10 10' : 'M10 4l10 10-10 10'}
        fill="none"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="square"
      />
    </svg>
  );
}
