import { ExitLink } from '@/components/nav/ExitLink';

type PreviewState = 'empty' | 'baking' | 'arrived';

type StateSpec = {
  id: PreviewState;
  index: string;
  label: string;
  title: string;
  description: string;
  filledCount: number;
  targetIndex: number;
  submitted: number;
  minted: number;
};

const STATES: StateSpec[] = [
  {
    id: 'empty',
    index: '01',
    label: 'EMPTY SHELF',
    title: '비어 있어도 기다림이 보인다',
    description: '열다섯 칸을 모두 설명하지 않고, 첫 쿠키가 놓일 자리 하나만 먼저 약속합니다.',
    filledCount: 0,
    targetIndex: 0,
    submitted: 0,
    minted: 0,
  },
  {
    id: 'baking',
    index: '02',
    label: 'IN THE OVEN',
    title: '과정보다 목적지를 먼저 보여준다',
    description: '오븐은 지금 일어나고 있는 일을 알리고, 진열장의 다음 자리가 결과를 예고합니다.',
    filledCount: 3,
    targetIndex: 3,
    submitted: 4,
    minted: 3,
  },
  {
    id: 'arrived',
    index: '03',
    label: 'ON THE SHELF',
    title: '도착한 자리만 완료를 말한다',
    description: '움직임이 끝난 뒤에는 발행 번호와 이름만 남겨, 내 것이 생겼다는 증거에 집중합니다.',
    filledCount: 4,
    targetIndex: 3,
    submitted: 4,
    minted: 4,
  },
];

const CARD_DATA = [
  { nickname: '초코산', tokenId: 1042, pattern: 'dots' },
  { nickname: '눈꽃', tokenId: 1043, pattern: 'stripe' },
  { nickname: '마들렌', tokenId: 1044, pattern: 'cross' },
  { nickname: '민트별', tokenId: 1045, pattern: 'star' },
] as const;

export function Styleguide() {
  return (
    <main className="sg-page">
      <div className="display-exit">
        <ExitLink label="처음 화면" href="/" tone="quiet" />
      </div>
      <header className="sg-intro">
        <div className="sg-intro__meta">
          <span>DISPLAY SYSTEM · DIRECTION 01</span>
          <span>1920 × 1080 · 55 INCH · 3–5 M</span>
        </div>
        <div className="sg-intro__title">
          <h1>기다림의 자리를<br />먼저 만든다.</h1>
          <p>
            오븐은 과정을 말하고,<br />
            진열장은 결과를 약속합니다.
          </p>
        </div>
        <dl className="sg-principles">
          <div>
            <dt>ONE FOCUS</dt>
            <dd>진열장의 다음 빈자리</dd>
          </div>
          <div>
            <dt>FLAIR BUDGET</dt>
            <dd>Avalanche 레드 색면 하나</dd>
          </div>
          <div>
            <dt>MOTION</dt>
            <dd>오븐에서 자리까지의 이동만</dd>
          </div>
        </dl>
      </header>

      <section className="sg-states" aria-label="TV 화면 상태 비교">
        {STATES.map((state) => (
          <article className="sg-state" key={state.id}>
            <header className="sg-state__copy">
              <div className="sg-state__index">
                <span>{state.index}</span>
                <b>{state.label}</b>
              </div>
              <div>
                <h2>{state.title}</h2>
                <p>{state.description}</p>
              </div>
            </header>
            <DisplayPreview state={state} />
          </article>
        ))}
      </section>

      <footer className="sg-footer">
        <span>AVALANCHE BAKERY · DISPLAY STUDY</span>
        <p>강조는 다음 자리에서 시작하고, 도착한 카드에서 끝납니다.</p>
      </footer>
    </main>
  );
}

function DisplayPreview({ state }: { state: StateSpec }) {
  return (
    <div className="sg-screen-wrap">
      <section className={`sg-screen sg-screen--${state.id}`} aria-label={`${state.title} TV 시안`}>
        <DisplayTopBar submitted={state.submitted} minted={state.minted} />
        <div className="sg-display-body">
          <Oven state={state.id} />
          <Showcase state={state} />
        </div>
      </section>
      <div className="sg-screen-spec" aria-hidden="true">
        <span>16:9</span>
        <span>MIN TYPE 24 PX @ 1920</span>
      </div>
    </div>
  );
}

function DisplayTopBar({ submitted, minted }: { submitted: number; minted: number }) {
  return (
    <header className="sg-display-topbar">
      <div className="sg-brand">
        <span className="sg-brand__mark">A</span>
        <strong>AVALANCHE<br />BAKERY</strong>
      </div>
      <span className="sg-event-label">COOKIE CLASS · SEOUL · AUG 15</span>
      <div className="sg-counts" aria-label={`접수 ${submitted}개, 진열 ${minted}개`}>
        <span>접수 <b>{String(submitted).padStart(2, '0')}</b></span>
        <span>진열 <b>{String(minted).padStart(2, '0')}</b></span>
      </div>
    </header>
  );
}

function Oven({ state }: { state: PreviewState }) {
  const isBaking = state === 'baking';

  return (
    <aside className="sg-oven">
      <div className="sg-oven__heading">
        <span>BAKE COUNTER</span>
        <strong>증서 오븐</strong>
      </div>
      <div className={`sg-oven__window ${isBaking ? 'is-baking' : ''}`}>
        {isBaking ? (
          <div className="sg-oven-card">
            <CookieArt pattern="star" />
            <strong>민트별</strong>
          </div>
        ) : (
          <i className="sg-oven__tray" aria-hidden="true" />
        )}
      </div>
      <div className="sg-oven__status">
        <span>{isBaking ? 'NOW BAKING' : 'READY'}</span>
        <strong>{isBaking ? '증서를 굽는 중' : '다음 쿠키를 기다려요'}</strong>
      </div>
    </aside>
  );
}

function Showcase({ state }: { state: StateSpec }) {
  return (
    <section className="sg-showcase">
      <header className="sg-showcase__heading">
        <div>
          <span>TODAY&apos;S SHELF</span>
          <h3>오늘의 진열장</h3>
        </div>
        <strong>{String(state.minted).padStart(2, '0')} <span>/ 15</span></strong>
      </header>
      <ol className="sg-shelf" aria-label="쿠키 증서 진열장 15칸">
        {Array.from({ length: 15 }, (_, index) => {
          const isFilled = index < state.filledCount;
          const isTarget = index === state.targetIndex;
          const isArrived = state.id === 'arrived' && isTarget;
          const card = isFilled ? CARD_DATA[index] : null;

          return (
            <li
              className={`sg-slot ${isFilled ? 'is-filled' : ''} ${isTarget ? 'is-target' : ''} ${isArrived ? 'is-arrived' : ''}`}
              key={index}
            >
              <span className="sg-slot__number">{String(index + 1).padStart(2, '0')}</span>
              {card ? (
                <CertificateCard card={card} />
              ) : isTarget ? (
                <div className="sg-target">
                  <span>{state.id === 'empty' ? 'FIRST PLACE' : 'NEXT PLACE'}</span>
                  <strong>{state.id === 'empty' ? '첫 쿠키 자리' : '다음 쿠키 자리'}</strong>
                  <i aria-hidden="true" />
                </div>
              ) : (
                <i className="sg-slot__rest" aria-hidden="true" />
              )}
            </li>
          );
        })}
      </ol>
    </section>
  );
}

function CertificateCard({
  card,
}: {
  card: (typeof CARD_DATA)[number];
}) {
  return (
    <div className="sg-certificate">
      <CookieArt pattern={card.pattern} />
      <div className="sg-certificate__name">
        <strong>{card.nickname}</strong>
        <span>#{card.tokenId}</span>
      </div>
    </div>
  );
}

function CookieArt({ pattern }: { pattern: (typeof CARD_DATA)[number]['pattern'] }) {
  return (
    <span className={`sg-cookie sg-cookie--${pattern}`} aria-hidden="true">
      <i />
      <i />
      <i />
    </span>
  );
}
