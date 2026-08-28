'use client';

import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';

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
  lead?: string;
};

export const SESSION_SLIDES: readonly SessionSlide[] = [
  {
    id: 'opening',
    title: '방금 받은 참가증서, 이렇게 만들었습니다',
    lead: '어디에 저장되고, 누구 소유로 남는지 짧게 보겠습니다.',
  },
  {
    id: 'anatomy',
    title: 'NFT 한 장은 세 가지로 이루어집니다',
  },
  {
    id: 'storage',
    title: '증서 파일은 IPFS에, 소유 기록은 C-Chain에 남습니다',
  },
  {
    id: 'wallet',
    title: 'NFT의 주인은 Google 계정이 아니라 지갑 주소입니다',
  },
  {
    id: 'minting',
    title: '제출부터 진열까지 다섯 단계를 거칩니다',
  },
  {
    id: 'certificate',
    title: 'ERC-721 형식이지만 다른 지갑으로 보낼 수 없습니다',
  },
  {
    id: 'chain',
    title: '공개되는 것과 공개하지 않는 것',
  },
] as const;

export function SessionDeck({
  slide,
  stale,
  onSlide,
  onExit,
  exitLabel = '진열장으로 돌아가기',
}: {
  slide: number;
  stale: boolean;
  onSlide: (slide: number) => void;
  onExit: () => void;
  exitLabel?: string;
}) {
  const reduceMotion = useReducedMotion();
  const currentIndex = Math.min(Math.max(slide, 0), SESSION_SLIDES.length - 1);
  const current = SESSION_SLIDES[currentIndex];
  const last = currentIndex === SESSION_SLIDES.length - 1;

  return (
    <section className={`session-deck session-deck--${current.id}`} aria-label="NFT 교육 세션">
      <TopBar stale={stale} />

      <div className="session-stage">
        <AnimatePresence initial={false} mode="sync">
          <motion.article
            className={`session-slide session-slide--${current.id}`}
            key={current.id}
            role="group"
            aria-roledescription="슬라이드"
            aria-label={`${currentIndex + 1} / ${SESSION_SLIDES.length}`}
            initial={reduceMotion ? false : { clipPath: 'inset(0 0 0 100%)' }}
            animate={{ clipPath: 'inset(0 0 0 0)' }}
            exit={reduceMotion ? undefined : { clipPath: 'inset(0 100% 0 0)' }}
            transition={{ duration: reduceMotion ? 0 : 0.4, ease: [0.22, 1, 0.36, 1] }}
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
            {exitLabel}
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
  if (slide.id === 'opening') return <OpeningSlide slide={slide} />;

  return (
    <div className="session-panel">
      <header className="session-slide-head">
        <h1>{slide.title}</h1>
      </header>
      <div className="session-slide-body">
        {slide.id === 'anatomy' ? <AnatomySlide /> : null}
        {slide.id === 'storage' ? <StorageSlide /> : null}
        {slide.id === 'wallet' ? <WalletSlide /> : null}
        {slide.id === 'minting' ? <MintingSlide /> : null}
        {slide.id === 'certificate' ? <CertificateSlide /> : null}
        {slide.id === 'chain' ? <ChainSlide /> : null}
      </div>
    </div>
  );
}

function OpeningSlide({ slide }: { slide: SessionSlide }) {
  return (
    <div className="session-opening">
      <div className="opening-copy">
        <h1>{slide.title}</h1>
        <p>{slide.lead}</p>
        <div className="opening-definition">
          <strong>블록체인</strong>
          <span>여러 사람이 같은 내용을 확인하는 공개 기록</span>
        </div>
        <div className="opening-parts" aria-label="참가증서를 이루는 세 요소">
          <span>쿠키 사진</span>
          <i aria-hidden="true" />
          <span>증서 정보</span>
          <i aria-hidden="true" />
          <span>지갑 소유 기록</span>
        </div>
      </div>
    </div>
  );
}

function AnatomySlide() {
  return (
    <div className="anatomy-flow">
      <ol>
        <li>
          <span className="anatomy-step-number">1</span>
          <div className="anatomy-step-copy">
            <strong>증서 이미지</strong>
            <p>쿠키 사진과 프레임을 합친 완성본</p>
          </div>
        </li>
        <li>
          <span className="anatomy-step-number">2</span>
          <div className="anatomy-step-copy">
            <strong>메타데이터</strong>
            <p>증서 이름과 이미지를 설명하는 정보</p>
          </div>
        </li>
        <li>
          <span className="anatomy-step-number">3</span>
          <div className="anatomy-step-copy">
            <strong>ERC-721 토큰</strong>
            <p>증서 번호와 소유 지갑을 연결한 기록</p>
          </div>
        </li>
      </ol>
      <p className="session-memory-line">세 요소가 연결돼 지갑과 Explorer에 NFT 한 장으로 보입니다.</p>
    </div>
  );
}

function StorageSlide() {
  return (
    <div className="storage-proof">
      <section className="storage-field storage-field--ipfs">
        <header>
          <span>IPFS</span>
          <strong>파일을 보관합니다</strong>
          <p>완성된 증서와 증서 설명을 보관합니다.</p>
        </header>
        <dl className="storage-records">
          <div>
            <dt>참가증서 이미지</dt>
            <dd>쿠키 사진과 프레임을 합친 완성본</dd>
          </div>
          <div>
            <dt>메타데이터</dt>
            <dd>증서 이름과 이미지를 설명하는 정보</dd>
          </div>
        </dl>
      </section>
      <div className="storage-bridge">
        <strong>연결</strong>
        <i aria-hidden="true" />
      </div>
      <section className="storage-field storage-field--chain">
        <header>
          <span>C-CHAIN</span>
          <strong>소유권을 기록합니다</strong>
          <p>토큰 번호와 소유 지갑 같은 핵심 기록을 남깁니다.</p>
        </header>
        <dl className="storage-records">
          <div>
            <dt>증서 번호</dt>
            <dd>한 장마다 부여되는 번호</dd>
          </div>
          <div>
            <dt>소유 지갑</dt>
            <dd>참가자의 지갑 주소</dd>
          </div>
          <div>
            <dt>증서 정보</dt>
            <dd>IPFS에 보관한 메타데이터의 주소</dd>
          </div>
        </dl>
      </section>
      <aside className="storage-original">
        <strong>원본 쿠키 사진은 브라우저에서만 사용했습니다.</strong>
        <span>서버에는 완성된 참가증서만 보냈습니다.</span>
      </aside>
    </div>
  );
}

function WalletSlide() {
  return (
    <div className="wallet-proof">
      <div className="wallet-path">
        <section>
          <span>로그인</span>
          <strong>Google</strong>
          <p>참가자를 확인할 때만 사용합니다.</p>
        </section>
        <Arrow direction="right" />
        <section>
          <span>지갑 생성</span>
          <strong>Privy</strong>
          <p>참가자용 지갑과 주소를 만듭니다.</p>
        </section>
        <Arrow direction="right" />
        <section className="wallet-owner">
          <span>NFT 소유자</span>
          <strong>참가자 지갑</strong>
          <p>블록체인에서 공개 계정 번호처럼 쓰는 주소입니다.</p>
        </section>
      </div>

      <dl className="wallet-roles">
        <div><dt>지갑 주소</dt><dd>공개되는 계정 번호</dd></div>
        <div><dt>개인키</dt><dd>지갑을 쓰는 비밀 정보</dd></div>
        <div><dt>서버 민터</dt><dd>가스비를 내고 발행만</dd></div>
      </dl>
      <p className="wallet-key-note">참가자 개인키는 서버가 받거나 저장하지 않습니다.</p>
    </div>
  );
}

function MintingSlide() {
  const steps = [
    ['1', '증서 제출', '브라우저가 만든 완성본 한 장', 'SUBMITTED'],
    ['2', 'IPFS 저장', '이미지와 메타데이터에 CID 생성', 'PINNED'],
    ['3', '민팅 요청', '서버가 가스비를 내고 발행 요청', 'MINTING'],
    ['4', '결과 확인', '영수증과 발행 이벤트 확인', null],
    ['5', '진열', 'tokenId와 txHash 저장', 'MINTED'],
  ] as const;

  return (
    <div className="minting-flow">
      <ol className="minting-steps">
        {steps.map(([number, title, description, state]) => (
          <li key={number}>
            <span>{number}</span>
            <strong>{title}</strong>
            <p>{description}</p>
            {state ? <code>{state}</code> : null}
          </li>
        ))}
      </ol>
      <div className="minting-notes">
        <p><strong>민팅</strong><span>블록체인에 새 토큰을 발행하는 것</span></p>
        <p><strong>처리 방식</strong><span><b>한 번에 한 명씩</b> 순서대로</span></p>
      </div>
    </div>
  );
}

function CertificateSlide() {
  return (
    <div className="certificate-proof">
      <section className="erc-standard">
        <strong>ERC-721</strong>
        <p>지갑과 Explorer가 NFT를 읽을 때 쓰는 공통 규격입니다.</p>
        <dl>
          <div><dt>tokenId</dt><dd>증서 번호</dd></div>
          <div><dt>ownerOf</dt><dd>소유 지갑 주소</dd></div>
          <div><dt>tokenURI</dt><dd>메타데이터 주소</dd></div>
        </dl>
      </section>

      <section className="locked-rules">
        <strong>EIP-5192 Locked</strong>
        <p>전송할 수 없다는 상태를 표시하는 잠금 규칙입니다.</p>
        <ul>
          <li><span>다른 지갑으로 보내기</span><b>불가</b></li>
          <li><span>거래를 위한 승인</span><b>불가</b></li>
          <li><span>일반 발급</span><b>지갑당 한 장</b></li>
        </ul>
      </section>

      <p className="certificate-result">
        NFT라고 모두 거래할 수 있는 것은 아닙니다. <b>전송과 판매는 막혀 있습니다.</b>
      </p>
    </div>
  );
}

function ChainSlide() {
  return (
    <div className="chain-proof">
      <section className="chain-public">
        <h2>공개되는 것</h2>
        <dl>
          <div>
            <dt>C-Chain</dt>
            <dd>증서 번호 · 소유 지갑 · 증서 정보 주소 · 발행 기록</dd>
          </div>
          <div>
            <dt>IPFS</dt>
            <dd>최종 참가증서(쿠키 사진·닉네임) · 증서 정보</dd>
          </div>
        </dl>
      </section>
      <section className="chain-private">
        <h2>공개하지 않는 것</h2>
        <p>원본 사진</p>
        <p>Google 계정</p>
        <p>참가자 개인키</p>
      </section>
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
