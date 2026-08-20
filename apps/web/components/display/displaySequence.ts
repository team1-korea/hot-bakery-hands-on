'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { Entry, EntryStatus } from '@/lib/api/types';
import { CARD_DROP_MS, CARD_MOVE_MS, CARD_SETTLE_MS, SHOWCASE_COMPLETE_MS } from './motion';
import { useOvenSlots } from './ovenSlots';
export type CardMotionPhase = 'enter' | 'to-oven' | 'to-shelf';
type BoundaryMove = { entry: Entry; phase: Exclude<CardMotionPhase, 'enter'> };
const MIN_OVEN_MS = 2_000; const MAX_ACTIVE_MOVES = 1;
/**
 * 카드가 놓일 구역. "누가 손대야 하는가"로 나뉜다.
 * 작업대에 남는 것은 전부 운영자가 볼 것이다 — 사진을 아직 안 낸 사람과 실패한 사람.
 */
function zone(status: EntryStatus) {
  if (status === 'MINTED') return 'shelf';
  if (status === 'JOINED' || status === 'FAILED') return 'workbench';
  return 'oven';   // SUBMITTED · PINNED · MINTING
}
function boundaryMove(previous: Entry, next: Entry): BoundaryMove | null {
  const from = zone(previous.status);
  const to = zone(next.status);
  if (from === to) return null;
  if (to === 'oven') return { entry: next, phase: 'to-oven' };
  if (to === 'shelf') return { entry: next, phase: 'to-shelf' };
  return null;
}
function entryCounts(entries: Entry[]) {
  return {
    submitted: entries.length,
    minted: entries.filter((entry) => entry.status === 'MINTED').length,
  };
}
export function useDisplaySequence(source: Entry[], reducedMotion: boolean) {
  const [entries, setEntries] = useState(source);
  const [phases, setPhases] = useState<Map<string, CardMotionPhase>>(new Map());
  const [arrivalIds, setArrivalIds] = useState<Set<string>>(new Set());
  const [counts, setCounts] = useState(() => entryCounts(source));
  const [boundaryBusy, setBoundaryBusy] = useState(false);
  const { ovenSlots, assignOvenSlot, releaseOvenSlot, resetOvenSlots, hasOpenOvenSlot, hasOvenSlot } = useOvenSlots(source);
  const sourceMap = useRef(new Map(source.map((entry) => [entry.id, entry])));
  const latestSource = useRef(source);
  const queue = useRef<BoundaryMove[]>([]);
  const activeMoves = useRef(new Map<string, BoundaryMove>());
  const ovenEnteredAt = useRef(new Map<string, number>());
  const initialSync = useRef(true);
  const schedulerTimer = useRef<number | null>(null);
  const timers = useRef<Set<number>>(new Set());
  const startNextRef = useRef<() => void>(() => {});
  const later = useCallback((callback: () => void, delay: number) => {
    const timer = window.setTimeout(() => {
      timers.current.delete(timer);
      callback();
    }, delay);
    timers.current.add(timer);
    return timer;
  }, []);
  const markArrival = useCallback((id: string) => {
    const landed = latestSource.current.find((entry) => entry.id === id && entry.status === 'MINTED');
    if (!landed) return;
    setArrivalIds((current) => new Set([...current, id]));
    setCounts((current) => ({
      submitted: current.submitted,
      minted: Math.min(current.minted + 1, entryCounts(latestSource.current).minted),
    }));
    later(() => setArrivalIds((current) => {
      const next = new Set(current);
      next.delete(id);
      return next;
    }), SHOWCASE_COMPLETE_MS);
  }, [later]);
  const startNext = useCallback(() => {
    if (reducedMotion || schedulerTimer.current !== null) return;
    if (activeMoves.current.size >= MAX_ACTIVE_MOVES || queue.current.length === 0) return;
    const now = Date.now();
    const index = queue.current.findIndex((move) => {
      if (activeMoves.current.has(move.entry.id)) return false;
      if (move.phase === 'to-oven') return hasOpenOvenSlot();
      const enteredAt = ovenEnteredAt.current.get(move.entry.id);
      return enteredAt !== undefined && now - enteredAt >= MIN_OVEN_MS;
    });
    if (index < 0) {
      const waits = queue.current.flatMap((move) => {
        const enteredAt = ovenEnteredAt.current.get(move.entry.id);
        return move.phase === 'to-shelf' && enteredAt !== undefined
          ? [Math.max(0, MIN_OVEN_MS - (now - enteredAt))]
          : [];
      });
      if (waits.length > 0) {
        schedulerTimer.current = later(() => {
          schedulerTimer.current = null;
          startNextRef.current();
        }, Math.min(...waits));
      }
      return;
    }
    const [move] = queue.current.splice(index, 1);
    activeMoves.current.set(move.entry.id, move);
    if (move.phase === 'to-oven') {
      assignOvenSlot(move.entry.id);
      ovenEnteredAt.current.set(move.entry.id, Date.now());
      setEntries((current) => current.map((entry) => entry.id === move.entry.id ? move.entry : entry));
    }
    setPhases((current) => new Map(current).set(move.entry.id, move.phase));
    later(() => {
      if (move.phase === 'to-shelf') {
        setEntries((current) => current.map((entry) => entry.id === move.entry.id ? move.entry : entry));
        releaseOvenSlot(move.entry.id);
        markArrival(move.entry.id);
      }
      setPhases((current) => {
        const next = new Map(current);
        next.delete(move.entry.id);
        return next;
      });
    }, CARD_MOVE_MS);
    later(() => {
      activeMoves.current.delete(move.entry.id);
      if (move.phase === 'to-shelf') ovenEnteredAt.current.delete(move.entry.id);
      if (queue.current.length === 0 && activeMoves.current.size === 0) setBoundaryBusy(false);
      startNextRef.current();
    }, CARD_MOVE_MS + CARD_SETTLE_MS);
  }, [assignOvenSlot, hasOpenOvenSlot, later, markArrival, reducedMotion, releaseOvenSlot]);
  useEffect(() => { startNextRef.current = startNext; }, [startNext]);
  useEffect(() => {
    latestSource.current = source;
    if (source.length === 0) {
      resetOvenSlots([]);
    }
    let initialMoves: BoundaryMove[] = [];
    if (initialSync.current) {
      const observedAt = Date.now();
      source.filter((entry) => entry.status === 'MINTING' && hasOvenSlot(entry.id)).forEach((entry) => {
        ovenEnteredAt.current.set(entry.id, observedAt);
      });
      initialMoves = source.filter((entry) => entry.status === 'MINTING' && !hasOvenSlot(entry.id))
        .map((entry) => ({ entry, phase: 'to-oven' }));
      initialSync.current = false;
    }
    const previous = sourceMap.current;
    const moves = [...initialMoves, ...source.flatMap((entry) => {
      const oldEntry = previous.get(entry.id);
      const move = oldEntry ? boundaryMove(oldEntry, entry) : null;
      return move && !entry.hidden ? [move] : [];
    })];
    const newEntries = source.filter((entry) => !previous.has(entry.id));
    sourceMap.current = new Map(source.map((entry) => [entry.id, entry]));
    later(() => {
      if (reducedMotion) {
        timers.current.forEach((timer) => window.clearTimeout(timer));
        timers.current.clear();
        schedulerTimer.current = null;
        queue.current = [];
        activeMoves.current.clear();
        ovenEnteredAt.current.clear();
        resetOvenSlots(source);
        setBoundaryBusy(false);
        setEntries(source);
        setPhases(new Map());
        setCounts(entryCounts(source));
        moves.filter((move) => move.phase === 'to-shelf').forEach((move) => markArrival(move.entry.id));
        return;
      }
      const pendingIds = new Set([
        ...queue.current.map((move) => move.entry.id),
        ...activeMoves.current.keys(),
        ...moves.map((move) => move.entry.id),
      ]);
      setEntries((current) => {
        const currentById = new Map(current.map((entry) => [entry.id, entry]));
        return source.map((entry) => pendingIds.has(entry.id) && currentById.has(entry.id)
          ? currentById.get(entry.id)!
          : entry);
      });
      if (newEntries.length > 0) {
        setPhases((current) => {
          const next = new Map(current);
          newEntries.forEach((entry) => next.set(entry.id, 'enter'));
          return next;
        });
        later(() => setCounts((current) => ({ ...current, submitted: latestSource.current.length })), CARD_DROP_MS);
        later(() => setPhases((current) => {
          const next = new Map(current);
          newEntries.forEach((entry) => next.delete(entry.id));
          return next;
        }), CARD_DROP_MS + CARD_SETTLE_MS);
      }
      if (moves.length > 0) {
        queue.current.push(...moves);
        setBoundaryBusy(true);
      }
      const rawCounts = entryCounts(source);
      setCounts((current) => ({
        submitted: rawCounts.submitted < current.submitted ? rawCounts.submitted : current.submitted,
        minted: rawCounts.minted < current.minted ? rawCounts.minted : current.minted,
      }));
      startNext();
    }, 0);
  }, [hasOvenSlot, later, markArrival, reducedMotion, resetOvenSlots, source, startNext]);
  useEffect(() => () => {
    timers.current.forEach((timer) => window.clearTimeout(timer));
    timers.current.clear();
  }, []);
  return { entries, phases, arrivalIds, counts, boundaryBusy, ovenSlots };
}
