'use client';

import { useEffect, useState } from 'react';

import { USING_MOCK_SERVER, logoutOperator, updateEntry, updateShow } from '@/lib/api/client';
import { MAX_ENTRIES, SHELF_SLOTS, type Entry, type EntryStatus } from '@/lib/api/types';
import { useEventState } from '@/lib/useEventState';

const STATUS_LABEL: Record<EntryStatus, string> = {
  SUBMITTED: '사진 도착',
  RENDERED: '증서 준비',
  PINNED: '굽기 대기',
  MINTING: '굽는 중',
  MINTED: '진열 완료',
  FAILED: '실패',
};

/**
 * 실패 이유는 서버가 준 문장이다. 그 안에 내부 상태 이름이 섞여 오면 운영자가 읽는 말로 바꿔 준다.
 * 모르는 낱말은 건드리지 않는다.
 */
function readableReason(reason: string) {
  return reason.replace(/\b(SUBMITTED|RENDERED|PINNED|MINTING|MINTED|FAILED)\b/g, (status) => (
    STATUS_LABEL[status as EntryStatus]
  ));
}

export function AdminBoard() {
  const { state, stale } = useEventState();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [failedOnly, setFailedOnly] = useState(false);
  const [zoomed, setZoomed] = useState<Entry | null>(null);

  const pageCount = Math.max(1, Math.ceil(state.counts.submitted / SHELF_SLOTS));
  const page = Math.min(state.show.shelfPage, pageCount - 1);
  const failedCount = state.entries.filter((entry) => entry.status === 'FAILED').length;
  const zoomedEntry = zoomed ? state.entries.find((entry) => entry.id === zoomed.id) ?? null : null;
  const rows = failedOnly
    ? state.entries.filter((entry) => entry.status === 'FAILED')
    : state.entries;

  // 폴링이 다음 주기에 서버 상태로 덮어쓰므로 낙관적 갱신을 따로 두지 않는다.
  const act = async (id: string, task: () => Promise<unknown>) => {
    setBusyId(id);
    try {
      await task();
    } finally {
      setBusyId(null);
    }
  };

  const logout = async () => {
    await logoutOperator();
    window.location.reload();
  };

  return (
    <main className="admin">
      {/* 표가 길어져도 조작이 손에서 벗어나지 않게 붙여 둔다. */}
      <div className="admin-sticky">
        <header className="admin-head">
          <h1>운영자 화면</h1>
          <div className="admin-counts">
            <span>제출 <b>{state.counts.submitted}</b> / {MAX_ENTRIES}</span>
            <span>진열 <b>{state.counts.minted}</b></span>
            <span data-tone={failedCount > 0 ? 'alert' : undefined}>실패 <b>{failedCount}</b></span>
            {USING_MOCK_SERVER ? <span className="admin-mock">목 서버</span> : null}
          <button className="admin-button" type="button" onClick={logout}>나가기</button>
          </div>
        </header>

        <div className="admin-show">
          <span>앞 화면</span>
          <button
            className="admin-button"
            type="button"
            aria-pressed={state.show.qrVisible}
            onClick={() => updateShow({ qrVisible: !state.show.qrVisible })}
          >
            QR 표시
          </button>
          <button
            className="admin-button"
            type="button"
            aria-pressed={state.show.layout === 'GALLERY'}
            onClick={() => updateShow({ layout: state.show.layout === 'GALLERY' ? 'LIVE' : 'GALLERY' })}
          >
            진열장만 크게
          </button>

          <span>진열장 쪽</span>
          <button
            className="admin-button"
            type="button"
            disabled={page === 0}
            onClick={() => updateShow({ shelfPage: page - 1 })}
          >
            이전
          </button>
          <strong className="admin-page">{page + 1} / {pageCount}</strong>
          <button
            className="admin-button"
            type="button"
            disabled={page >= pageCount - 1}
            onClick={() => updateShow({ shelfPage: page + 1 })}
          >
            다음
          </button>

          <button
            className="admin-button admin-filter"
            type="button"
            aria-pressed={failedOnly}
            disabled={failedCount === 0}
            onClick={() => setFailedOnly((value) => !value)}
          >
            실패만 보기
          </button>
        </div>
      </div>

      {stale ? (
        <p className="admin-alert">
          서버에서 응답이 없어요. 이 화면과 행사장 TV가 모두 멈춰 있습니다.
        </p>
      ) : null}

      {state.counts.submitted >= MAX_ENTRIES ? (
        <p className="admin-alert">진열장이 다 찼어요. 지금부터 참가자는 사진을 보낼 수 없습니다.</p>
      ) : null}

      {rows.length === 0 ? (
        <p className="admin-empty">
          {failedOnly ? '실패한 참가자가 없어요.' : '아직 제출한 참가자가 없어요.'}
        </p>
      ) : (
        <table className="admin-table">
          <thead>
            <tr>
              <th>칸</th>
              <th>사진</th>
              <th>이름</th>
              <th>상태</th>
              <th>증서</th>
              <th>조작</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((entry) => (
              <Row
                key={entry.id}
                entry={entry}
                busy={busyId === entry.id}
                onAct={act}
                onZoom={() => setZoomed(entry)}
              />
            ))}
          </tbody>
        </table>
      )}

      {zoomedEntry ? (
        <PhotoViewer
          entry={zoomedEntry}
          busy={busyId === zoomedEntry.id}
          onClose={() => setZoomed(null)}
          onAct={act}
        />
      ) : null}
    </main>
  );
}

/**
 * 참가자가 올린 사진을 크게 본다. 앞 화면에 걸어 둘 사진인지 여기서 판단하고 그 자리에서 내린다.
 */
function PhotoViewer({ entry, busy, onClose, onAct }: {
  entry: Entry;
  busy: boolean;
  onClose: () => void;
  onAct: (id: string, task: () => Promise<unknown>) => Promise<void>;
}) {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  return (
    <div className="admin-viewer" role="dialog" aria-modal="true" aria-label={`${entry.nickname}의 사진`}>
      <button className="admin-viewer-backdrop" type="button" aria-label="닫기" onClick={onClose} />
      <div className="admin-viewer-panel">
        {entry.photoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={entry.photoUrl} alt={`${entry.nickname}의 쿠키 사진`} />
        ) : null}
        <div className="admin-viewer-foot">
          <div>
            <strong>{entry.nickname}</strong>
            <small>{String((entry.shelfIndex ?? 0) + 1).padStart(2, '0')}번 칸</small>
          </div>
          <button
            className="admin-button"
            type="button"
            disabled={busy}
            autoFocus
            onClick={() => onAct(entry.id, () => updateEntry(entry.id, { hidden: !entry.hidden }))}
          >
            {entry.hidden ? '앞 화면에 올리기' : '앞 화면에서 내리기'}
          </button>
          <button className="admin-button" type="button" onClick={onClose}>닫기</button>
        </div>
      </div>
    </div>
  );
}

function Row({ entry, busy, onAct, onZoom }: {
  entry: Entry;
  busy: boolean;
  onAct: (id: string, task: () => Promise<unknown>) => Promise<void>;
  onZoom: () => void;
}) {
  const shelfPage = Math.floor((entry.shelfIndex ?? 0) / SHELF_SLOTS) + 1;

  return (
    <tr data-hidden={entry.hidden}>
      <td className="admin-shelf">
        {String((entry.shelfIndex ?? 0) + 1).padStart(2, '0')}
        <small>{shelfPage}쪽</small>
      </td>
      <td>
        {entry.photoUrl ? (
          <button className="admin-thumb-button" type="button" onClick={onZoom} aria-label={`${entry.nickname}의 사진 크게 보기`}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img className="admin-thumb" src={entry.photoUrl} alt="" />
          </button>
        ) : null}
      </td>
      <td>{entry.nickname}</td>
      <td>
        <span className="admin-status" data-status={entry.status}>{STATUS_LABEL[entry.status]}</span>
        {entry.failureReason ? (
          <small className="admin-reason">{readableReason(entry.failureReason)}</small>
        ) : null}
      </td>
      <td className="admin-token">{entry.tokenId ? `#${entry.tokenId}` : '—'}</td>
      <td>
        {entry.status === 'FAILED' ? (
          <button
            className="admin-button"
            type="button"
            disabled={busy}
            onClick={() => onAct(entry.id, () => updateEntry(entry.id, { retry: true }))}
          >
            다시 시도
          </button>
        ) : null}
        <button
          className="admin-button"
          type="button"
          disabled={busy}
          aria-pressed={entry.hidden}
          onClick={() => onAct(entry.id, () => updateEntry(entry.id, { hidden: !entry.hidden }))}
        >
          {entry.hidden ? '올리기' : '내리기'}
        </button>
      </td>
    </tr>
  );
}
