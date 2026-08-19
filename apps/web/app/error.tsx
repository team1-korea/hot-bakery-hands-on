'use client';

import { useEffect } from 'react';

/**
 * 행사장 TV에 영어 스택 트레이스가 뜨는 일만은 없어야 한다.
 *
 * 참가자에게 원인을 설명해 봐야 할 수 있는 일이 없으므로, 할 수 있는 두 가지만 남긴다.
 * 다시 시도하거나 운영자를 부르거나.
 */
export default function AppError({ error, reset }: { error: Error; reset: () => void }) {
  useEffect(() => {
    // 화면에는 내보내지 않는다. 노트북 콘솔에는 남겨야 행사 중에 원인을 볼 수 있다.
    console.error(error);
  }, [error]);

  return (
    <main className="oops">
      <p className="oops-mark">AVALANCHE BAKERY</p>
      <h1>잠시 문제가<br />생겼어요</h1>
      <p className="oops-note">다시 시도해도 같으면 운영자에게 말씀해 주세요.</p>
      <button className="oops-button" type="button" onClick={reset}>
        다시 시도
      </button>
    </main>
  );
}
