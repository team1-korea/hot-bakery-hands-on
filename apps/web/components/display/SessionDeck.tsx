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
  | 'core'
  | 'chain';

export type SessionSlide = {
  id: SessionSlideId;
  title: string;
  lead: string;
};

export const SESSION_SLIDES: readonly SessionSlide[] = [
  {
    id: 'opening',
    title: '내 쿠키 사진이, 내 지갑의 참가증서가 되었습니다',
    lead: '사진 파일 하나가 NFT로 변한 것이 아니라, 이미지와 설명을 가리키는 소유 기록을 발행했습니다.',
  },
  {
    id: 'anatomy',
    title: 'NFT는 세 가지가 연결된 하나의 기록입니다',
    lead: '눈에 보이는 이미지, 이미지를 설명하는 메타데이터, 소유자를 정하는 토큰이 서로를 가리킵니다.',
  },
  {
    id: 'storage',
    title: '사진은 IPFS에, 소유 기록은 C-Chain에 남습니다',
    lead: '큰 이미지 파일을 체인에 넣지 않고, 내용으로 만든 주소를 토큰에 연결했습니다.',
  },
  {
    id: 'wallet',
    title: 'Google은 로그인 수단, 지갑 주소가 실제 소유자입니다',
    lead: 'Privy가 로그인 계정에 연결된 지갑을 만들고, 참가증서는 그 지갑 주소로 발행됐습니다.',
  },
  {
    id: 'minting',
    title: '제출한 뒤, 한 사람씩 즉시 발행했습니다',
    lead: '브라우저의 합성본이 진열장 카드가 되기까지 서버와 체인이 같은 순서로 확인했습니다.',
  },
  {
    id: 'certificate',
    title: 'ERC-721 규격 위에, 전송 잠금 규칙을 더했습니다',
    lead: '표준 지갑이 읽을 수 있는 NFT이지만, 사고팔거나 다른 주소로 보낼 수 없는 참가증서입니다.',
  },
  {
    id: 'core',
    title: '행사 뒤에는 Core에서 같은 지갑을 열 수 있습니다',
    lead: 'NFT를 새 지갑으로 보내는 것이 아니라, Privy 지갑의 개인키를 본인 기기의 Core에 가져옵니다.',
  },
  {
    id: 'chain',
    title: '발행 기록은 공개되고, 개인키는 공개되지 않습니다',
    lead: 'Explorer에서는 토큰과 소유 주소, 메타데이터 URI, 발행 거래를 누구나 확인할 수 있습니다.',
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
    <section className={`session-deck session-deck--${current.id}`} aria-label="NFT 교육 세션">
      <TopBar stale={stale} />

      <div className="session-stage">
        <AnimatePresence initial={false} mode="wait">
          <motion.article
            className={`session-slide session-slide--${current.id}`}
            key={current.id}
            role="group"
            aria-roledescription="슬라이드"
            aria-label={`${currentIndex + 1} / ${SESSION_SLIDES.length}`}
            initial={reduceMotion ? false : { clipPath: 'inset(0 0 0 100%)' }}
            animate={{ clipPath: 'inset(0 0 0 0)' }}
            exit={reduceMotion ? undefined : { clipPath: 'inset(0 100% 0 0)' }}
            transition={{ duration: reduceMotion ? 0 : 0.46, ease: [0.22, 1, 0.36, 1] }}
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
  if (slide.id === 'opening') return <OpeningSlide slide={slide} />;

  return (
    <div className="session-panel">
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
        {slide.id === 'core' ? <CoreSlide /> : null}
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
      </div>
      <div className="opening-proof" aria-label="이미지, 메타데이터, 토큰의 연결">
        <div className="opening-proof-image">
          {/* 예시 이미지는 확정 증서 원본을 공개하지 않기 위해 별도로 만든 교육용 일러스트다. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/assets/session/certificate-illustration-v1.png"
            alt="예시용 쿠키 참가증서"
          />
          <div>
            <span>IMAGE · 예시</span>
            <strong>쿠키 참가증서</strong>
            <small>certificate.jpg</small>
          </div>
        </div>
        <div className="opening-proof-link" aria-hidden="true" />
        <div className="opening-proof-data">
          <span>METADATA</span>
          <code>{'{ name, image, attributes }'}</code>
        </div>
        <div className="opening-proof-token">
          <span>TOKEN</span>
          <strong>#8</strong>
          <code>owner 0x…A91C</code>
        </div>
      </div>
    </div>
  );
}

function AnatomySlide() {
  return (
    <div className="anatomy-map">
      <section className="anatomy-layer anatomy-layer--image">
        <span>보이는 것</span>
        <strong>증서 이미지</strong>
        <p>쿠키 사진과 프레임을 합친 JPEG</p>
        <code>certificate.jpg</code>
      </section>
      <ConnectionMark label="설명한다" />
      <section className="anatomy-layer anatomy-layer--metadata">
        <span>설명하는 것</span>
        <strong>메타데이터</strong>
        <p>이름 · 설명 · 이미지 CID · 행사 정보</p>
        <code>ipfs://metadata-CID</code>
      </section>
      <ConnectionMark label="가리킨다" />
      <section className="anatomy-layer anatomy-layer--token">
        <span>소유를 정하는 것</span>
        <strong>ERC-721 토큰</strong>
        <p>tokenId · ownerOf · tokenURI</p>
        <code>C-Chain #8</code>
      </section>
      <p className="session-memory-line">셋 중 하나만 떼어 놓으면, 우리가 받은 NFT 전체를 설명할 수 없습니다.</p>
    </div>
  );
}

function ConnectionMark({ label }: { label: string }) {
  return (
    <div className="connection-mark" aria-label={label}>
      <i aria-hidden="true" />
      <span>{label}</span>
    </div>
  );
}

function StorageSlide() {
  return (
    <div className="storage-proof">
      <section className="storage-field storage-field--ipfs">
        <span>IPFS</span>
        <strong>최종 증서 이미지<br />+ 메타데이터</strong>
        <code>ipfs://bafy…</code>
        <p>파일 내용으로 CID를 만들고 Pinata가 고정합니다.</p>
      </section>
      <div className="storage-bridge">
        <span>tokenURI</span>
        <i aria-hidden="true" />
        <p>체인에는 파일 대신<br />메타데이터 주소를 기록</p>
      </div>
      <section className="storage-field storage-field--chain">
        <span>C-CHAIN</span>
        <strong>토큰 번호<br />+ 소유 지갑</strong>
        <code>#8 → 0x…A91C</code>
        <p>누가 무엇을 소유하는지 공개 기록으로 남깁니다.</p>
      </section>
      <aside className="storage-original">
        <strong>원본 쿠키 사진</strong>
        <span>브라우저에서 합성한 뒤 서버로 보내지지 않습니다.</span>
      </aside>
    </div>
  );
}

function WalletSlide() {
  return (
    <div className="wallet-proof">
      <div className="wallet-identity">
        <section>
          <span>로그인</span>
          <strong>Google</strong>
          <p>지갑을 여는 인증 수단</p>
        </section>
        <Arrow direction="right" />
        <section>
          <span>지갑 생성·연결</span>
          <strong>Privy</strong>
          <p>참가자용 임베디드 EVM 지갑</p>
        </section>
      </div>

      <div className="wallet-equation">
        <code>ownerOf(#8)</code>
        <span>=</span>
        <strong>0x…A91C</strong>
        <small>참가자 지갑 주소</small>
      </div>

      <div className="wallet-boundaries">
        <p><b>Google</b>은 NFT를 소유하지 않습니다.</p>
        <p><b>서버 민터</b>는 발행만 하고 소유하지 않습니다.</p>
        <p><b>개인키</b>는 참가자 본인만 관리합니다.</p>
      </div>
    </div>
  );
}

function MintingSlide() {
  const phases = [
    {
      label: '준비',
      description: '체인에 기록할 주소를 만듭니다.',
      steps: [
        ['1', '합성본 제출', '브라우저가 만든 최종 증서 한 장'],
        ['2', 'IPFS 고정', '이미지와 메타데이터에 CID 부여'],
      ],
    },
    {
      label: '발행',
      description: '소유자를 참가자 지갑으로 지정합니다.',
      steps: [
        ['3', 'mint 호출', '지갑 주소와 metadata URI를 전송'],
      ],
    },
    {
      label: '확인',
      description: '성공 기록을 확인한 뒤 화면에 올립니다.',
      steps: [
        ['4', '체인 확인', '영수증과 CertificateIssued 검증'],
        ['5', '진열 완료', 'tokenId와 txHash 저장'],
      ],
    },
  ] as const;

  return (
    <div className="minting-flow">
      <div className="minting-phases">
        {phases.map((phase) => (
          <section key={phase.label} data-phase={phase.label}>
            <header>
              <span>{phase.label}</span>
              <p>{phase.description}</p>
            </header>
            <ol>
              {phase.steps.map(([number, title, description]) => (
                <li key={number}>
                  <span>{number}</span>
                  <div>
                    <strong>{title}</strong>
                    <p>{description}</p>
                  </div>
                </li>
              ))}
            </ol>
          </section>
        ))}
      </div>
      <p className="minting-summary">
        <span><b>즉시</b> 제출한 사람부터 바로 시작</span>
        <span><b>직렬</b> 한 번에 한 사람씩 처리</span>
        <span><b>확인 후 진열</b> 성공 기록이 생긴 뒤 이동</span>
      </p>
    </div>
  );
}

function CertificateSlide() {
  return (
    <div className="certificate-proof">
      <section className="erc-standard">
        <strong>ERC-721</strong>
        <p>NFT를 지갑과 Explorer가 같은 방식으로 읽게 하는 공통 규격</p>
        <dl>
          <div><dt>tokenId</dt><dd>각 증서의 고유 번호</dd></div>
          <div><dt>ownerOf</dt><dd>현재 소유 지갑 주소</dd></div>
          <div><dt>tokenURI</dt><dd>이미지·정보를 가리키는 주소</dd></div>
        </dl>
      </section>

      <div className="certificate-plus" aria-hidden="true">+</div>

      <section className="locked-rules">
        <div className="locked-mark" aria-hidden="true">
          <svg viewBox="0 0 120 150">
            <path d="M30 66V47C30 22 44 8 60 8s30 14 30 39v19" />
            <rect x="12" y="63" width="96" height="78" />
            <circle cx="60" cy="96" r="8" />
            <path d="M60 104v17" />
          </svg>
        </div>
        <div>
          <span>EIP-5192 LOCKED</span>
          <strong>이번 참가증서의 규칙</strong>
          <ul>
            <li>전송과 승인 요청을 모두 거절</li>
            <li>처음 발행은 한 지갑에 한 장</li>
            <li>오발급은 소각 후 새 번호로 재발급</li>
          </ul>
        </div>
      </section>

      <p className="certificate-result">표준 NFT로 <b>읽을 수 있고</b>, 참가증서라서 <b>팔 수는 없습니다.</b></p>
    </div>
  );
}

function CoreSlide() {
  return (
    <div className="core-guide">
      <div className="core-message">
        <span>행사 후 이메일 안내</span>
        <strong>Core에서<br />같은 지갑 열기</strong>
        <p>Google 로그인에 사용한 이메일로 단계별 가이드를 보내드립니다.</p>
      </div>

      <ol className="core-steps">
        <li>
          <span>1</span>
          <strong>본인 인증</strong>
          <p>Privy에서 본인 인증을 마치고 개인키 내보내기를 선택합니다.</p>
        </li>
        <li>
          <span>2</span>
          <strong>계정 가져오기</strong>
          <p>본인 기기의 Core에서 Import Private Key를 선택합니다.</p>
        </li>
        <li>
          <span>3</span>
          <strong>주소 확인</strong>
          <p>Privy와 Core에 같은 지갑 주소가 나타나는지 확인합니다.</p>
        </li>
      </ol>

      <div className="core-continuity">
        <div><span>PRIVY</span><code>0x…A91C</code></div>
        <i aria-hidden="true"><b>전송 없음</b></i>
        <div><span>CORE</span><code>0x…A91C</code></div>
        <strong>앱만 달라지고 지갑 주소는 같습니다.</strong>
      </div>

      <aside className="core-warning">
        <strong>개인키는 지갑 소유권 자체입니다.</strong>
        <p>운영자에게 보내지 말고, 링크·메신저·공용 PC에 입력하지 마세요.</p>
      </aside>
    </div>
  );
}

function ChainSlide() {
  return (
    <div className="chain-proof">
      <section className="chain-receipt">
        <div className="chain-receipt-head">
          <span>{C_CHAIN.label} · 화면 예시</span>
          <strong>SUCCESS</strong>
        </div>
        <dl>
          <div><dt>CHAIN ID</dt><dd>{C_CHAIN.id}</dd></div>
          <div><dt>CONTRACT</dt><dd>Avalanche Bakery Certificate</dd></div>
          <div><dt>EVENT</dt><dd>CertificateIssued</dd></div>
          <div><dt>TOKEN</dt><dd>#8 → 0x…A91C</dd></div>
          <div><dt>TOKEN URI</dt><dd>ipfs://metadata-CID</dd></div>
        </dl>
      </section>

      <section className="chain-visibility">
        <div className="chain-visibility-item is-chain">
          <span>1 · C-CHAIN 공개 기록</span>
          <strong>tokenId · owner<br />tokenURI · 발행 거래와 이벤트</strong>
          <p>Explorer에서 누구나 확인할 수 있습니다.</p>
        </div>
        <div className="chain-visibility-item is-ipfs">
          <span>2 · IPFS 공개 파일</span>
          <strong>최종 참가증서 JPEG<br />메타데이터 JSON</strong>
          <p>tokenURI를 따라가면 현재 핀된 파일을 볼 수 있습니다.</p>
        </div>
        <div className="chain-visibility-item is-private">
          <span>3 · 수집하지 않거나 공개하지 않음</span>
          <strong>원본 사진 · Google 계정<br />참가자 개인키</strong>
          <p>원본 사진과 개인키는 서버가 받지 않습니다.</p>
        </div>
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
