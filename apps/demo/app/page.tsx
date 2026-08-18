import Link from 'next/link';

const ENTRY_ROUTES = [
  {
    href: '/demo',
    title: '행사 흐름 체험하기',
    lead: '휴대폰에서 사진을 보내고 TV에 진열될 때까지 이어서 봅니다.',
    action: '조건을 고르고 시작',
  },
  {
    href: '/join',
    title: '참가자 화면 열기',
    lead: '사진과 이름을 직접 보냅니다. 제출 뒤 휴대폰이 달라지는 A안과 B안을 골라서 봅니다.',
    action: 'A안 · B안 고르기',
  },
  {
    href: '/display',
    title: '행사장 TV 열기',
    lead: '접수된 쿠키가 오븐을 지나 진열되는 전체 화면입니다.',
    action: 'TV 화면 열기',
  },
] as const;

export default function Home() {
  return (
    <main className="home-index">
      <header className="home-topbar">
        <svg viewBox="0 0 1503 1504" aria-hidden="true">
          <path fillRule="evenodd" clipRule="evenodd" d="M1502.5 752c0 414.77-336.23 751-751 751-414.766 0-751-336.23-751-751C.5 337.234 336.734 1 751.5 1c414.77 0 751 336.234 751 751Zm-963.812 298.86H392.94c-30.626 0-45.754 0-54.978-5.9-9.963-6.46-16.051-17.16-16.789-28.97-.554-10.88 7.011-24.168 22.139-50.735l359.87-634.32c15.313-26.936 23.061-40.404 32.839-45.385 10.516-5.35 23.062-5.35 33.578 0 9.778 4.981 17.527 18.449 32.839 45.385l73.982 129.144.377.659c16.539 28.897 24.926 43.551 28.588 58.931 4.058 16.789 4.058 34.5 0 51.289-3.69 15.497-11.992 30.257-28.781 59.591L687.573 964.702l-.489.856c-16.648 29.135-25.085 43.902-36.778 55.042-12.73 12.18-28.043 21.03-44.832 26.02-15.313 4.24-32.47 4.24-66.786 4.24Zm368.062 0h208.84c30.81 0 46.31 0 55.54-6.08 9.96-6.46 16.23-17.35 16.79-29.15.53-10.53-6.87-23.3-21.37-48.323-.5-.852-1-1.719-1.51-2.601L1060.43 785.75l-1.19-2.015c-14.7-24.858-22.12-37.411-31.65-42.263-10.51-5.351-22.88-5.351-33.391 0-9.594 4.981-17.342 18.08-32.655 44.462L857.306 964.891l-.357.616c-15.259 26.34-22.885 39.503-22.335 50.303.738 11.81 6.826 22.69 16.788 29.15 9.041 5.9 24.538 5.9 55.348 5.9Z" fill="currentColor" />
        </svg>
        <strong>AVALANCHE BAKERY</strong>
      </header>

      <div className="home-content">
        <section className="home-story">
          <h1>쿠키를 굽고,<br />오늘을 진열해요.</h1>
          <p>사진 한 장이 행사장 오븐을 지나<br />오래 남는 참가 증서가 됩니다.</p>
          <div className="home-process" aria-label="참가 과정">
            <span>사진 보내기</span>
            <span>오븐에서 굽기</span>
            <span>증서로 진열</span>
          </div>
        </section>

        <nav className="home-entry-list" aria-label="화면 선택">
          {ENTRY_ROUTES.map((route, index) => (
            <Link href={route.href} className={index === 0 ? 'is-primary' : ''} key={route.href}>
              <span className="home-entry-copy">
                <strong>{route.title}</strong>
                <small>{route.lead}</small>
              </span>
              <b>{route.action}</b>
            </Link>
          ))}
        </nav>
      </div>
    </main>
  );
}
