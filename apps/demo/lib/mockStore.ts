import { DEFAULT_SHOW, makeEntry, STATUS_FLOW } from './mockData';
import type { Entry, EntryStatus, ShowState, StateResponse } from './types';

const MIN_OVEN_TIME = 2_000;
const listeners = new Set<() => void>();
const mintingStartedAt = new Map<string, number>();
const pendingMints = new Map<string, ReturnType<typeof setTimeout>>();

function response(entries: Entry[], show: ShowState): StateResponse {
  return {
    entries,
    show,
    counts: {
      submitted: entries.length,
      minted: entries.filter((entry) => entry.status === 'MINTED').length,
    },
  };
}

let state = response([], DEFAULT_SHOW);

function emit(next: StateResponse) {
  state = next;
  listeners.forEach((listener) => listener());
}

function updateEntries(updater: (entries: Entry[]) => Entry[]) {
  emit(response(updater(state.entries), state.show));
}

function updateShow(updater: (show: ShowState) => ShowState) {
  emit(response(state.entries, updater(state.show)));
}

function changeStatus(entry: Entry, status: EntryStatus): Entry {
  const minted = status === 'MINTED';
  return {
    ...entry,
    status,
    certificateUrl: minted
      ? `/mock/certificate-${((entry.shelfIndex ?? 0) % 6) + 1}.jpg`
      : null,
    tokenId: minted ? 1042 + (entry.shelfIndex ?? 0) : null,
    txHash: minted
      ? `0x${(1042 + (entry.shelfIndex ?? 0)).toString(16).padStart(64, '0')}`
      : null,
  };
}

function finishMint(id: string) {
  pendingMints.delete(id);
  mintingStartedAt.delete(id);
  updateEntries((entries) => entries.map((entry) => (
    entry.id === id && entry.status === 'MINTING' ? changeStatus(entry, 'MINTED') : entry
  )));
}

function requestAdvance(id: string) {
  const entry = state.entries.find((item) => item.id === id);
  if (!entry || entry.status === 'MINTED') return;

  if (entry.status === 'MINTING') {
    const elapsed = Date.now() - (mintingStartedAt.get(id) ?? Date.now());
    const remaining = MIN_OVEN_TIME - elapsed;
    if (remaining <= 0) finishMint(id);
    else if (!pendingMints.has(id)) {
      pendingMints.set(id, setTimeout(() => finishMint(id), remaining));
    }
    return;
  }

  const currentIndex = STATUS_FLOW.indexOf(entry.status);
  const nextStatus = entry.status === 'FAILED'
    ? 'PINNED'
    : STATUS_FLOW[Math.min(currentIndex + 1, STATUS_FLOW.length - 1)];
  if (nextStatus === 'MINTING') mintingStartedAt.set(id, Date.now());
  updateEntries((entries) => entries.map((item) => (
    item.id === id ? changeStatus(item, nextStatus) : item
  )));
}

function clearMintTimers() {
  pendingMints.forEach((timer) => clearTimeout(timer));
  pendingMints.clear();
  mintingStartedAt.clear();
}

export const mockStore = {
  getSnapshot: () => state,
  subscribe(listener: () => void) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
};

export const mockActions = {
  addParticipants(amount: number) {
    updateEntries((entries) => {
      const addCount = Math.min(amount, Math.max(0, 15 - entries.length));
      return [...entries, ...Array.from({ length: addCount }, (_, offset) => (
        makeEntry(entries.length + offset, 'SUBMITTED')
      ))];
    });
  },
  advanceAll() {
    state.entries.map((entry) => entry.id).forEach(requestAdvance);
  },
  advanceOne(id: string) {
    requestAdvance(id);
  },
  autoStep() {
    const eligible = state.entries.filter((entry) => entry.status !== 'MINTED');
    if (eligible.length === 0) {
      if (state.entries.length < 15) mockActions.addParticipants(1);
      return;
    }
    mockActions.advanceOne(eligible[Math.floor(Math.random() * eligible.length)].id);
  },
  injectFailure() {
    const target = state.entries.find((entry) => (
      entry.status !== 'MINTED' && entry.status !== 'FAILED'
    ));
    if (!target) return;
    const timer = pendingMints.get(target.id);
    if (timer) clearTimeout(timer);
    pendingMints.delete(target.id);
    mintingStartedAt.delete(target.id);
    updateEntries((entries) => entries.map((entry) => (
      entry.id === target.id ? changeStatus(entry, 'FAILED') : entry
    )));
  },
  setView(view: 'LIVE' | 'GALLERY' | 'SLIDES') {
    updateShow((show) => ({
      ...show,
      mode: view === 'SLIDES' ? 'SLIDES' : 'BAKERY',
      layout: view === 'SLIDES' ? show.layout : view,
    }));
  },
  toggleQr() {
    updateShow((show) => ({ ...show, qrVisible: !show.qrVisible }));
  },
  reset() {
    clearMintTimers();
    emit(response([], DEFAULT_SHOW));
  },
};
