'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import type { AdminEntry } from '@/lib/api/adminTypes';
import { ApiError, logoutOperator } from '@/lib/api/client';
import { MAX_ENTRIES, SHELF_SLOTS, type EntryStatus } from '@/lib/api/types';

import {
  resetAdminData,
  runAdminSweep,
  updateAdminEntry,
  updateAdminShow,
  uploadEntryPhoto,
} from './adminApi';
import { buildCertificate } from './certificate';
import { useAdminState } from './useAdminState';

const STATUS_LABEL: Record<EntryStatus, string> = {
  // TV는 "사진 기다리는 중"이라고 부드럽게 말하지만, 운영자는 할 일이 남은 사람을 찾는 중이다.
  JOINED: '아직 안 냄',
  SUBMITTED: '사진 도착',
  PINNED: '굽기 대기',
  MINTING: '굽는 중',
  MINTED: '진열 완료',
  FAILED: '실패',
};

/** 명단을 좁히는 방법. */
type Filter = 'ALL' | 'PENDING' | 'FAILED';

/**
 * 행사가 끝날 무렵 운영자가 찾는 것은 "실패한 사람"이 아니라 **아직 증서를 못 받은 사람**이다.
 * 사진을 안 낸 사람도, 오븐에 걸려 있는 사람도 똑같이 불러서 알려 줘야 한다.
 */
function matches(entry: AdminEntry, filter: Filter) {
  if (filter === 'PENDING') return entry.status !== 'MINTED';
  if (filter === 'FAILED') return entry.status === 'FAILED';
  return true;
}

const EMPTY_MESSAGE: Record<Filter, string> = {
  ALL: '아직 등록한 참가자가 없어요.',
  PENDING: '모두 증서를 받았어요.',
  FAILED: '실패한 참가자가 없어요.',
};

/**
 * 실패 이유는 서버가 준 문장이다. 그 안에 내부 상태 이름이 섞여 오면 운영자가 읽는 말로 바꿔 준다.
 * 모르는 낱말은 건드리지 않는다.
 */
function readableReason(reason: string) {
  return reason.replace(/\b(JOINED|SUBMITTED|PINNED|MINTING|MINTED|FAILED)\b/g, (status) => (
    STATUS_LABEL[status as EntryStatus]
  ));
}

/** 칸은 사진을 내야 배정된다. 없는 것을 0번 칸으로 보여 주면 진열장에서 헛것을 찾게 된다. */
function shelfLabel(shelfIndex: number | null) {
  return shelfIndex === null ? '칸 없음' : `${String(shelfIndex + 1).padStart(2, '0')}번 칸`;
}

type Act = <T>(id: string, task: () => Promise<T>) => Promise<T | null>;

function errorMessage(cause: unknown, fallback = '조작을 완료하지 못했어요.') {
  return cause instanceof ApiError ? cause.message : fallback;
}

export function AdminBoard() {
  const { state, stale } = useAdminState();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>('ALL');
  const [query, setQuery] = useState('');
  const [zoomed, setZoomed] = useState<AdminEntry | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [resetOpen, setResetOpen] = useState(false);

  const pageCount = Math.max(1, Math.ceil(state.counts.submitted / SHELF_SLOTS));
  const page = Math.min(state.show.shelfPage, pageCount - 1);
  const failedCount = state.entries.filter((entry) => entry.status === 'FAILED').length;
  const pendingCount = state.entries.filter((entry) => entry.status !== 'MINTED').length;
  const zoomedEntry = zoomed ? state.entries.find((entry) => entry.id === zoomed.id) ?? null : null;
  const needle = query.trim().toLowerCase();
  const rows = state.entries.filter((entry) => (
    matches(entry, filter) && entry.nickname.toLowerCase().includes(needle)
  ));

  // 폴링이 다음 주기에 서버 상태로 덮어쓰므로 낙관적 갱신을 따로 두지 않는다.
  const act: Act = async (id, task) => {
    setBusyId(id);
    setActionError(null);
    setNotice(null);
    try {
      return await task();
    } catch (cause) {
      setActionError(errorMessage(cause));
      return null;
    } finally {
      setBusyId(null);
    }
  };

  const logout = async () => {
    const result = await act('logout', logoutOperator);
    if (result) window.location.reload();
  };

  const reset = async () => {
    const result = await act('reset', resetAdminData);
    if (!result) return;
    setZoomed(null);
    setResetOpen(false);
    setNotice(`테스트 데이터를 초기화했어요. 참가자 ${result.deleted.participants}명, 카드 ${result.deleted.entries}개를 지웠습니다.`);
  };
  const sweep = async () => {
    const result = await act('sweep', runAdminSweep);
    if (!result) return;
    const inspected = result.recovered + result.failed + result.deferred;
    setNotice(
      `멈춘 작업 ${inspected}건을 점검했어요. 복구 ${result.recovered}건, 실패 처리 ${result.failed}건, 다음 점검 ${result.deferred}건, 미제출 자동 내림 ${result.hidden}건입니다.`,
    );
  };
  const closeReset = useCallback(() => setResetOpen(false), []);

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
            {state.capabilities.mockServer ? <span className="admin-mock">목 서버</span> : null}
            {state.capabilities.resetDatabase ? (
              <button
                className="admin-button admin-danger"
                type="button"
                disabled={busyId !== null}
                onClick={() => setResetOpen(true)}
              >
                테스트 데이터 초기화
              </button>
            ) : null}
            <button className="admin-button" type="button" disabled={busyId === 'logout'} onClick={() => void logout()}>나가기</button>
          </div>
        </header>

        <div className="admin-show">
          <span>작업</span>
          <button
            className="admin-button"
            type="button"
            disabled={busyId !== null}
            onClick={() => void sweep()}
          >
            {busyId === 'sweep' ? '점검 중…' : '멈춘 작업 점검/복구'}
          </button>
          <span>앞 화면</span>
          <button
            className="admin-button"
            type="button"
            disabled={busyId === 'show'}
            aria-pressed={state.show.qrVisible}
            onClick={() => void act('show', () => updateAdminShow({ qrVisible: !state.show.qrVisible }))}
          >
            QR 표시
          </button>
          <button
            className="admin-button"
            type="button"
            disabled={busyId === 'show'}
            aria-pressed={state.show.layout === 'GALLERY'}
            onClick={() => void act('show', () => updateAdminShow({ layout: state.show.layout === 'GALLERY' ? 'LIVE' : 'GALLERY' }))}
          >
            진열장만 크게
          </button>

          <span>진열장 쪽</span>
          <button
            className="admin-button"
            type="button"
            disabled={page === 0 || busyId === 'show'}
            onClick={() => void act('show', () => updateAdminShow({ shelfPage: page - 1 }))}
          >
            이전
          </button>
          <strong className="admin-page">{page + 1} / {pageCount}</strong>
          <button
            className="admin-button"
            type="button"
            disabled={page >= pageCount - 1 || busyId === 'show'}
            onClick={() => void act('show', () => updateAdminShow({ shelfPage: page + 1 }))}
          >
            다음
          </button>

          <div className="admin-filter">
            {/* 손 든 참가자를 찾는 상황은 급하다. 14명이어도 눈으로 훑는 것보다 빠르다. */}
            <input
              className="admin-search"
              type="search"
              placeholder="닉네임 검색"
              aria-label="닉네임 검색"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
            <button
              className="admin-button"
              type="button"
              aria-pressed={filter === 'ALL'}
              onClick={() => setFilter('ALL')}
            >
              전체
            </button>
            <button
              className="admin-button"
              type="button"
              aria-pressed={filter === 'PENDING'}
              onClick={() => setFilter('PENDING')}
            >
              아직 못 받음 {pendingCount}
            </button>
            <button
              className="admin-button"
              type="button"
              aria-pressed={filter === 'FAILED'}
              onClick={() => setFilter('FAILED')}
            >
              실패 {failedCount}
            </button>
          </div>
        </div>
      </div>

      <div className="admin-feedback" aria-live="polite" aria-atomic="true">
        {actionError ? <p className="admin-alert" role="alert">{actionError}</p> : null}
        {notice ? <p className="admin-notice">{notice}</p> : null}
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
          {needle ? '그 닉네임은 명단에 없어요.' : EMPTY_MESSAGE[filter]}
        </p>
      ) : (
        <table className="admin-table">
          <thead>
            <tr>
              <th>칸</th>
              <th>사진</th>
              <th>닉네임</th>
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

      {resetOpen ? (
        <ResetDialog
          busy={busyId === 'reset'}
          onCancel={closeReset}
          onConfirm={() => void reset()}
        />
      ) : null}
    </main>
  );
}

/**
 * 참가자가 올린 증서를 크게 본다. 앞 화면에 걸어 둘 이미지인지 여기서 판단하고 그 자리에서 내린다.
 */
function PhotoViewer({ entry, busy, onClose, onAct }: {
  entry: AdminEntry;
  busy: boolean;
  onClose: () => void;
  onAct: Act;
}) {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  return (
    <div className="admin-viewer" role="dialog" aria-modal="true" aria-label={`${entry.nickname}의 참가증서`}>
      <button className="admin-viewer-backdrop" type="button" aria-label="닫기" onClick={onClose} />
      <div className="admin-viewer-panel">
        {entry.photoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={entry.photoUrl} alt={`${entry.nickname}의 참가증서`} />
        ) : null}
        <div className="admin-viewer-foot">
          <div>
            <strong>{entry.nickname}</strong>
            <small>{shelfLabel(entry.shelfIndex)}</small>
          </div>
          <button
            className="admin-button"
            type="button"
            disabled={busy}
            autoFocus
            onClick={() => void onAct(entry.id, () => updateAdminEntry(entry.id, { hidden: !entry.hidden }))}
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
  entry: AdminEntry;
  busy: boolean;
  onAct: Act;
  onZoom: () => void;
}) {
  const canUpload = entry.status === 'JOINED' || entry.status === 'FAILED';

  return (
    <tr data-hidden={entry.hidden}>
      <td className="admin-shelf">
        {entry.shelfIndex === null ? '—' : (
          <>
            {String(entry.shelfIndex + 1).padStart(2, '0')}
            <small>{Math.floor(entry.shelfIndex / SHELF_SLOTS) + 1}쪽</small>
          </>
        )}
      </td>
      <td>
        {entry.photoUrl ? (
          <button className="admin-thumb-button" type="button" onClick={onZoom} aria-label={`${entry.nickname}의 참가증서 크게 보기`}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img className="admin-thumb" src={entry.photoUrl} alt="" />
          </button>
        ) : null}
      </td>
      <td>
        <NicknameEditor entry={entry} busy={busy} onAct={onAct} />
      </td>
      <td>
        <span className="admin-status" data-status={entry.status}>{STATUS_LABEL[entry.status]}</span>
        {/* 스위퍼가 내린 것과 운영자가 내린 것은 다시 올릴지 판단이 다르다. */}
        {entry.hidden ? (
          <small className="admin-down">{entry.autoHidden ? '자동 내림' : '운영자가 내림'}</small>
        ) : null}
        {entry.failureReason ? (
          <small className="admin-reason">{readableReason(entry.failureReason)}</small>
        ) : null}
      </td>
      <td className="admin-token">{entry.tokenId ? `#${entry.tokenId}` : '—'}</td>
      <td className="admin-ops">
        {entry.status === 'FAILED' ? (
          // 버튼은 하나다. 무엇부터 다시 할지는 서버가 정한다.
          <button
            className="admin-button"
            type="button"
            disabled={busy}
            onClick={() => void onAct(entry.id, () => updateAdminEntry(entry.id, { retry: true }))}
          >
            다시 시도
          </button>
        ) : null}
        {canUpload ? <ProxyUpload entry={entry} rowBusy={busy} onAct={onAct} /> : null}
        <button
          className="admin-button"
          type="button"
          disabled={busy}
          aria-pressed={entry.hidden}
          onClick={() => void onAct(entry.id, () => updateAdminEntry(entry.id, { hidden: !entry.hidden }))}
        >
          {entry.hidden ? '올리기' : '내리기'}
        </button>
      </td>
    </tr>
  );
}

function NicknameEditor({ entry, busy, onAct }: {
  entry: AdminEntry;
  busy: boolean;
  onAct: Act;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(entry.nickname);
  const trimmed = draft.trim();

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!trimmed || trimmed.length > 12 || trimmed === entry.nickname) return;
    const result = await onAct(entry.id, () => updateAdminEntry(entry.id, { nickname: trimmed }));
    if (result) setEditing(false);
  };

  if (!editing || !entry.nicknameEditable) {
    return (
      <div className="admin-nickname">
        <span>{entry.nickname}</span>
        {entry.nicknameEditable ? (
          <button
            className="admin-icon-button"
            type="button"
            disabled={busy}
            aria-label={`${entry.nickname} 닉네임 수정`}
            onClick={() => {
              setDraft(entry.nickname);
              setEditing(true);
            }}
          >
            수정
          </button>
        ) : null}
      </div>
    );
  }

  return (
    <form className="admin-nickname-edit" onSubmit={(event) => void save(event)}>
      <label className="admin-visually-hidden" htmlFor={`nickname-${entry.id}`}>닉네임</label>
      <input
        id={`nickname-${entry.id}`}
        value={draft}
        maxLength={12}
        autoFocus
        disabled={busy}
        aria-describedby={`nickname-help-${entry.id}`}
        onChange={(event) => setDraft(event.target.value)}
      />
      <small id={`nickname-help-${entry.id}`}>{draft.length}/12자</small>
      <button
        className="admin-button"
        type="submit"
        disabled={busy || !trimmed || trimmed === entry.nickname}
      >
        저장
      </button>
      <button className="admin-button" type="button" disabled={busy} onClick={() => setEditing(false)}>
        취소
      </button>
    </form>
  );
}

/**
 * 대리 업로드. 이 화면이 존재하는 이유다.
 *
 * 참가자 폰이 사진을 못 올릴 때 운영자가 텔레그램·에어드랍·재촬영 무엇으로든 손에 넣어
 * 대신 올린다. `JOINED`(아직 안 냄)와 `FAILED`(사진 자체가 문제였을 수 있다) 둘 다에서 쓴다.
 *
 * 보내는 것은 원본이 아니라 합성이 끝난 증서다. 서버는 이미지를 다시 그리지 않는다.
 */
function ProxyUpload({ entry, rowBusy, onAct }: {
  entry: AdminEntry;
  rowBusy: boolean;
  onAct: Act;
}) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pick = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    // 값을 비워야 같은 파일을 다시 고를 수 있다. 한 번 실패한 뒤 그대로 재시도하는 일이 실제로 있다.
    event.target.value = '';
    if (!file) return;

    setError(null);
    setUploading(true);
    void onAct(entry.id, async () => {
      try {
        await uploadEntryPhoto(entry.id, await buildCertificate(file, entry.nickname));
      } catch (cause) {
        // 사진 형식·정원 초과처럼 할 일이 갈리는 오류가 온다. 서버 문장을 그대로 보여 준다.
        setError(cause instanceof ApiError ? cause.message : '사진을 올리지 못했어요.');
      } finally {
        setUploading(false);
      }
    });
  };

  return (
    <>
      <label className="admin-button admin-upload" data-busy={uploading || rowBusy ? 'true' : undefined}>
        {uploading ? '올리는 중…' : '사진 대신 올리기'}
        <input type="file" accept="image/*" disabled={uploading || rowBusy} onChange={pick} />
      </label>
      {error ? <small className="admin-reason">{error}</small> : null}
    </>
  );
}

const RESET_CONFIRMATION = '테스트 데이터 삭제';

function ResetDialog({ busy, onCancel, onConfirm }: {
  busy: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const [confirmation, setConfirmation] = useState('');
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const previouslyFocused = document.activeElement as HTMLElement | null;
    const panel = panelRef.current;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Tab' || !panel) return;
      const focusable = Array.from(panel.querySelectorAll<HTMLElement>(
        'button:not(:disabled), input:not(:disabled), [href], [tabindex]:not([tabindex="-1"])',
      ));
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      previouslyFocused?.focus();
    };
  }, []);

  useEffect(() => {
    if (busy) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      onCancel();
    };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [busy, onCancel]);

  const confirmed = confirmation === RESET_CONFIRMATION;

  return (
    <div className="admin-viewer" role="dialog" aria-modal="true" aria-labelledby="reset-title" aria-describedby="reset-description">
      <button className="admin-viewer-backdrop" type="button" aria-label="초기화 취소" disabled={busy} onClick={onCancel} />
      <div className="admin-viewer-panel admin-reset-panel" ref={panelRef}>
        <h2 id="reset-title">테스트 데이터를 초기화할까요?</h2>
        <div id="reset-description" className="admin-reset-copy">
          <p>참가자, 카드, 저장된 이미지를 지우고 TV 화면 설정을 처음으로 돌립니다.</p>
          <p><b>IPFS에 핀된 파일과 이미 발행된 증서는 지워지지 않습니다.</b> 발행에 쓴 지갑 주소도 다시 사용할 수 없습니다.</p>
        </div>
        <label className="admin-reset-confirm">
          <span>계속하려면 <b>{RESET_CONFIRMATION}</b>를 입력하세요.</span>
          <input
            value={confirmation}
            autoFocus
            disabled={busy}
            autoComplete="off"
            onChange={(event) => setConfirmation(event.target.value)}
          />
        </label>
        <div className="admin-reset-actions">
          <button className="admin-button" type="button" disabled={busy} onClick={onCancel}>취소</button>
          <button className="admin-button admin-danger" type="button" disabled={busy || !confirmed} onClick={onConfirm}>
            {busy ? '초기화 중…' : '모두 지우기'}
          </button>
        </div>
      </div>
    </div>
  );
}
