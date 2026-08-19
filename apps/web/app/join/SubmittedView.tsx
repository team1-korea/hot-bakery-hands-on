'use client';

import { useEffect, useState } from 'react';

import { getMyEntry } from '@/lib/api/client';
import type { Entry } from '@/lib/api/types';

const POLL_MS = 3_000;

/** 이 시간을 넘겨도 발행이 끝나지 않으면 참가자에게 도움을 청하라고 알린다. */
const SLOW_AFTER_MS = 3 * 60 * 1000;

function isSettled(entry: Entry) {
  return entry.status === 'MINTED' || entry.status === 'FAILED';
}

/**
 * A안: 제출을 마치면 휴대폰은 과정을 설명하지 않는다.
 * 앞 화면을 보라고만 말하고, 발행이 끝났을 때 결과 한 장만 보여준다.
 */
export function SubmittedView({ initialEntry }: { initialEntry: Entry }) {
  const [entry, setEntry] = useState(initialEntry);
  const [slow, setSlow] = useState(false);

  useEffect(() => {
    if (isSettled(entry)) return;

    const timer = window.setInterval(async () => {
      try {
        const next = await getMyEntry();
        if (next) setEntry(next);
      } catch {
        // 행사장 네트워크가 잠깐 끊겨도 다음 주기에 다시 시도한다.
      }
    }, POLL_MS);

    return () => window.clearInterval(timer);
  }, [entry]);

  useEffect(() => {
    if (isSettled(entry)) return;
    const elapsed = Date.now() - new Date(entry.submittedAt).getTime();
    const timer = window.setTimeout(() => setSlow(true), Math.max(0, SLOW_AFTER_MS - elapsed));
    return () => window.clearTimeout(timer);
  }, [entry]);

  if (entry.status === 'FAILED') {
    return (
      <section className="join-wait">
        <h1>다시 보내야 해요</h1>
        <p className="join-error">발행이 끝나지 못했어요. 진행을 도와드릴게요. 운영자에게 말씀해 주세요.</p>
      </section>
    );
  }

  if (entry.status === 'MINTED') {
    return (
      <section className="join-wait">
        <h1>완성됐어요</h1>
        <div className="join-certificate">
          {entry.photoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={entry.photoUrl} alt={`${entry.nickname}의 쿠키`} />
          ) : null}
          <div className="join-certificate-foot">
            <strong>{entry.nickname}</strong>
            <b>#{entry.tokenId}</b>
          </div>
        </div>
        <p className="join-shelf">앞 화면에서 <b>#{entry.tokenId}</b>을 찾아보세요</p>
      </section>
    );
  }

  return (
    <section className="join-wait">
      <h1>당신의 쿠키를<br />굽고 있어요</h1>
      <div className="join-look-up">
        <small>지금은 폰에서 할 일이 없어요</small>
        <strong>고개를 들어<br />앞 화면을 보세요</strong>
      </div>
      <p className="join-shelf">다 구워지면 증서 번호가 나와요</p>
      {slow ? (
        <p className="join-error">생각보다 오래 걸리고 있어요. 운영자에게 말씀해 주세요.</p>
      ) : null}
    </section>
  );
}
