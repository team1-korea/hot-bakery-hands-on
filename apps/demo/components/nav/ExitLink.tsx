import Link from 'next/link';

function BackArrow() {
  return (
    <svg className="exit-arrow" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M14.5 5 8 12l6.5 7" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="square" />
    </svg>
  );
}

/**
 * 모든 전체화면 프로토타입에서 같은 모양으로 쓰는 되돌아가기.
 * href를 주면 라우팅, onClick을 주면 화면 안 이전 단계로 돌아간다.
 */
export function ExitLink({
  label,
  href,
  onClick,
  tone = 'ink',
}: {
  label: string;
  href?: string;
  onClick?: () => void;
  tone?: 'ink' | 'paper' | 'quiet';
}) {
  const className = `exit-link is-${tone}`;

  if (href) {
    return (
      <Link className={className} href={href}>
        <BackArrow />
        <span>{label}</span>
      </Link>
    );
  }

  return (
    <button className={className} type="button" onClick={onClick}>
      <BackArrow />
      <span>{label}</span>
    </button>
  );
}
