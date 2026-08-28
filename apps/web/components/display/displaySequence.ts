'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { Entry } from '@/lib/api/types';
import { entryZone } from './entryZone';
import { CARD_DROP_MS, CARD_MOVE_MS, CARD_SETTLE_MS, SHOWCASE_COMPLETE_MS } from './motion';
import { useOvenSlots } from './ovenSlots';
export type CardMotionPhase = 'enter' | 'to-oven' | 'to-shelf';
type BoundaryMove = { entry: Entry; phase: Exclude<CardMotionPhase, 'enter'> };
const MIN_OVEN_MS = 2_000; const MAX_ACTIVE_MOVES = 1;
function boundaryMove(previous: Entry, next: Entry): BoundaryMove | null {
  const from = entryZone(previous.status);
  const to = entryZone(next.status);
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
export function useDisplaySequence(source: Entry[], reducedMotion: boolean, ready = true) {
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
  const initialized = useRef(false);
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
      // 처리 중에는 오븐 밖에서 기다렸지만 그사이 민팅이 끝난 카드도 있다.
      // 같은 카드의 오븐 이동이 앞에 남아 있으면 진열장 이동이 그것을 추월하지 않는다.
      const waitingForOven = queue.current.some((candidate) => (
        candidate !== move
        && candidate.entry.id === move.entry.id
        && candidate.phase === 'to-oven'
      ));
      if (waitingForOven) return false;
      const enteredAt = ovenEnteredAt.current.get(move.entry.id);
      return enteredAt === undefined || now - enteredAt >= MIN_OVEN_MS;
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
      if (activeMoves.current.get(move.entry.id) !== move) return;
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
      if (activeMoves.current.get(move.entry.id) === move) {
        activeMoves.current.delete(move.entry.id);
        if (move.phase === 'to-shelf') ovenEnteredAt.current.delete(move.entry.id);
      }
      if (queue.current.length === 0 && activeMoves.current.size === 0) setBoundaryBusy(false);
      startNextRef.current();
    }, CARD_MOVE_MS + CARD_SETTLE_MS);
  }, [assignOvenSlot, hasOpenOvenSlot, later, markArrival, reducedMotion, releaseOvenSlot]);
  useEffect(() => { startNextRef.current = startNext; }, [startNext]);
  useEffect(() => {
    latestSource.current = source;
    if (!ready) return;

    if (!initialized.current) {
      resetOvenSlots(source);
      const observedAt = Date.now();
      source.filter((entry) => entryZone(entry.status) === 'oven' && !entry.hidden && hasOvenSlot(entry.id))
        .forEach((entry) => ovenEnteredAt.current.set(entry.id, observedAt));
      const waiting = source
        .filter((entry) => entryZone(entry.status) === 'oven' && !entry.hidden && !hasOvenSlot(entry.id))
        .map((entry): BoundaryMove => ({ entry, phase: 'to-oven' }));
      sourceMap.current = new Map(source.map((entry) => [entry.id, entry]));
      initialized.current = true;
      later(() => {
        if (waiting.length > 0) {
          queue.current.push(...waiting);
          setBoundaryBusy(true);
        }
        setEntries(source);
        setCounts(entryCounts(source));
        startNextRef.current();
      }, 0);
      return;
    }

    if (source.length === 0) {
      resetOvenSlots([]);
    }
    const previous = sourceMap.current;
    const latestEntries = new Map(source.map((entry) => [entry.id, entry]));
    const canceledActiveIds = new Set<string>();
    activeMoves.current.forEach((move, id) => {
      const latest = latestEntries.get(id);
      const target = move.phase === 'to-oven' ? 'oven' : 'shelf';
      const latestZone = latest ? entryZone(latest.status) : null;
      // 오븐으로 움직이는 동안 실제 민팅이 끝나도 시각적 이동은 마친다.
      // 이어서 큐에 들어갈 to-shelf가 최신 MINTED 상태를 반영한다.
      const finishedWhileEnteringOven = move.phase === 'to-oven' && latestZone === 'shelf';
      if (!latest || latest.hidden || (latestZone !== target && !finishedWhileEnteringOven)) {
        activeMoves.current.delete(id);
        releaseOvenSlot(id);
        ovenEnteredAt.current.delete(id);
        canceledActiveIds.add(id);
      }
    });
    if (canceledActiveIds.size > 0) {
      setPhases((current) => {
        const next = new Map(current);
        canceledActiveIds.forEach((id) => next.delete(id));
        return next;
      });
    }
    queue.current = queue.current.flatMap((move) => {
      const latest = latestEntries.get(move.entry.id);
      if (!latest || latest.hidden) return [];
      if (move.phase === 'to-oven') {
        if (hasOvenSlot(latest.id)) return [];
        const latestZone = entryZone(latest.status);
        if (latestZone === 'workbench') return [];
        // 기다리는 동안 MINTED가 된 경우에도 기존 처리 상태를 보존해 오븐을 먼저 거친다.
        // 최신 MINTED 엔트리는 뒤따르는 to-shelf 이동이 반영한다.
        if (latestZone === 'shelf') return [move];
        return [{ ...move, entry: latest }];
      }
      if (move.phase === 'to-shelf' && entryZone(latest.status) !== 'shelf') return [];
      return [{ ...move, entry: latest }];
    });
    if (queue.current.length === 0 && activeMoves.current.size === 0) setBoundaryBusy(false);
    source.forEach((entry) => {
      const oldEntry = previous.get(entry.id);
      const returnedToWorkbench = oldEntry
        && entryZone(oldEntry.status) === 'oven'
        && entryZone(entry.status) === 'workbench';
      if (hasOvenSlot(entry.id) && (entry.hidden || returnedToWorkbench)) {
        releaseOvenSlot(entry.id);
        ovenEnteredAt.current.delete(entry.id);
      }
    });
    const moves = source.flatMap((entry) => {
      const oldEntry = previous.get(entry.id);
      if (!entry.hidden && entryZone(entry.status) === 'oven' && !hasOvenSlot(entry.id)) {
        if (!oldEntry || oldEntry.hidden || entryZone(oldEntry.status) !== 'oven') {
          return [{ entry, phase: 'to-oven' } satisfies BoundaryMove];
        }
      }
      const move = oldEntry ? boundaryMove(oldEntry, entry) : null;
      return move && !entry.hidden ? [move] : [];
    });
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
        const newMintedEntries = newEntries.filter((entry) => !entry.hidden && entry.status === 'MINTED');
        setPhases((current) => {
          const next = new Map(current);
          newEntries.forEach((entry) => next.set(entry.id, 'enter'));
          return next;
        });
        later(() => {
          setCounts((current) => ({ ...current, submitted: latestSource.current.length }));
          newMintedEntries.forEach((entry) => markArrival(entry.id));
        }, CARD_DROP_MS);
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
  }, [hasOvenSlot, later, markArrival, ready, reducedMotion, releaseOvenSlot, resetOvenSlots, source, startNext]);
  useEffect(() => () => {
    timers.current.forEach((timer) => window.clearTimeout(timer));
    timers.current.clear();
  }, []);
  return { entries, phases, arrivalIds, counts, boundaryBusy, ovenSlots };
}
