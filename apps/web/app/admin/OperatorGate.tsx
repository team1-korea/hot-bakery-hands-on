'use client';

import { useEffect, useState } from 'react';

import { ApiError, checkOperator, loginOperator } from '@/lib/api/client';

/** 운영 조작은 비밀번호 뒤에 둔다. TV로 투사되는 화면과 분리된 이유다. */
export function OperatorGate({ children }: { children: React.ReactNode }) {
  const [allowed, setAllowed] = useState<boolean | null>(null);
  const [passcode, setPasscode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    checkOperator()
      .then(() => setAllowed(true))
      .catch(() => setAllowed(false));
  }, []);

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      await loginOperator(passcode);
      setAllowed(true);
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : '잠시 후 다시 시도해 주세요.');
    } finally {
      setBusy(false);
    }
  };

  if (allowed === null) return <main className="admin" />;
  if (allowed) return <>{children}</>;

  return (
    <main className="admin admin-gate">
      <h1>운영자 화면</h1>
      <p>행사 운영자만 들어옵니다.</p>
      <label>
        <span>비밀번호</span>
        <input
          type="password"
          autoComplete="current-password"
          value={passcode}
          onChange={(event) => setPasscode(event.target.value)}
          onKeyDown={(event) => { if (event.key === 'Enter') void submit(); }}
        />
      </label>
      {error ? <p className="admin-alert">{error}</p> : null}
      <button className="admin-button" type="button" disabled={busy || !passcode} onClick={submit}>
        {busy ? '확인 중…' : '들어가기'}
      </button>
    </main>
  );
}
