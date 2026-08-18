import Link from 'next/link';

import { ExitLink } from '@/components/nav/ExitLink';

import { PROCESS_STEPS } from './_shared/processSteps';
import { JOIN_VARIANTS } from './_shared/variants';

/** 제출 뒤 A안 휴대폰. 문구 한 장에서 멈춘다. */
function PreviewA() {
  return (
    <div className="picker-phone is-a">
      <b>당신의 쿠키를<br />굽고 있어요</b>
      <span>지금은 폰에서 할 일이 없어요</span>
      <strong>고개를 들어<br />앞 화면을 보세요</strong>
      <small>당신의 자리는 7번 칸</small>
    </div>
  );
}

/** 제출 뒤 B안 휴대폰. 네 단계가 차례로 켜진다. */
function PreviewB() {
  return (
    <div className="picker-phone is-b">
      <b>쿠키가 증서가 되는 길</b>
      <ol>
        {PROCESS_STEPS.map(([title], index) => (
          <li className={index < 1 ? 'is-past' : index === 1 ? 'is-current' : ''} key={title}>
            <i />
            <span>{title}</span>
          </li>
        ))}
      </ol>
      <small>지금 만들고 있는 증서 열기</small>
    </div>
  );
}

export default function JoinPickerPage() {
  return (
    <main className="join-picker">
      <header className="join-picker-top">
        <svg viewBox="0 0 1503 1504" aria-hidden="true">
          <path fillRule="evenodd" clipRule="evenodd" d="M1502.5 752c0 414.77-336.23 751-751 751-414.766 0-751-336.23-751-751C.5 337.234 336.734 1 751.5 1c414.77 0 751 336.234 751 751Zm-963.812 298.86H392.94c-30.626 0-45.754 0-54.978-5.9-9.963-6.46-16.051-17.16-16.789-28.97-.554-10.88 7.011-24.168 22.139-50.735l359.87-634.32c15.313-26.936 23.061-40.404 32.839-45.385 10.516-5.35 23.062-5.35 33.578 0 9.778 4.981 17.527 18.449 32.839 45.385l73.982 129.144.377.659c16.539 28.897 24.926 43.551 28.588 58.931 4.058 16.789 4.058 34.5 0 51.289-3.69 15.497-11.992 30.257-28.781 59.591L687.573 964.702l-.489.856c-16.648 29.135-25.085 43.902-36.778 55.042-12.73 12.18-28.043 21.03-44.832 26.02-15.313 4.24-32.47 4.24-66.786 4.24Zm368.062 0h208.84c30.81 0 46.31 0 55.54-6.08 9.96-6.46 16.23-17.35 16.79-29.15.53-10.53-6.87-23.3-21.37-48.323-.5-.852-1-1.719-1.51-2.601L1060.43 785.75l-1.19-2.015c-14.7-24.858-22.12-37.411-31.65-42.263-10.51-5.351-22.88-5.351-33.391 0-9.594 4.981-17.342 18.08-32.655 44.462L857.306 964.891l-.357.616c-15.259 26.34-22.885 39.503-22.335 50.303.738 11.81 6.826 22.69 16.788 29.15 9.041 5.9 24.538 5.9 55.348 5.9Z" fill="currentColor" />
        </svg>
        <strong>AVALANCHE BAKERY</strong>
        <ExitLink label="처음 화면" href="/" tone="ink" />
      </header>

      <section className="join-picker-intro">
        <h1>참가자 화면을<br />골라요</h1>
        <p>두 안은 제출까지 똑같습니다. 차이는 제출을 마친 뒤 휴대폰에서 시작돼요.</p>
      </section>

      <div className="join-picker-cards">
        {JOIN_VARIANTS.map((variant) => (
          <Link className={`join-picker-card is-${variant.id}`} href={variant.href} key={variant.id}>
            <header>
              <b>{variant.id.toUpperCase()}</b>
              <span><strong>{variant.title}</strong><small>{variant.copy}</small></span>
            </header>

            <div className="join-picker-preview" aria-hidden="true">
              {variant.id === 'a' ? <PreviewA /> : <PreviewB />}
            </div>

            <ul className="join-picker-points">
              {variant.afterSubmit.map((point) => <li key={point}>{point}</li>)}
            </ul>

            <b className="join-picker-cta">{variant.id.toUpperCase()}안 휴대폰 화면 열기</b>
          </Link>
        ))}
      </div>
    </main>
  );
}
