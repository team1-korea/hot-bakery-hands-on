'use client';

import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { useCallback, useEffect, useId, useRef } from 'react';

const FOCUSABLE = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';

/**
 * 폰 화면 안에서 열리는 되돌아보기 패널.
 * 폰 캔버스(390×844) 안에 갇히도록 absolute로 두고, 데모 안에서 열려도
 * 시뮬레이터 단축키가 함께 반응하지 않게 키 이벤트를 여기서 끊는다.
 */
export function PhoneSheet({
  open,
  title,
  onClose,
  children,
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  const sheetRef = useRef<HTMLElement | null>(null);
  const closeRef = useRef<HTMLButtonElement | null>(null);
  const restoreRef = useRef<HTMLElement | null>(null);
  const reduceMotion = useReducedMotion();
  const titleId = useId();

  const close = useCallback(() => {
    onClose();
    restoreRef.current?.focus();
  }, [onClose]);

  useEffect(() => {
    if (!open) return;
    restoreRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const focusTimer = window.setTimeout(() => closeRef.current?.focus(), 0);

    const onKeyDown = (event: KeyboardEvent) => {
      const inside = sheetRef.current?.contains(event.target as Node) ?? false;
      if (event.key === 'Escape') {
        event.stopPropagation();
        close();
        return;
      }
      if (event.key === 'Tab' && sheetRef.current) {
        const focusable = Array.from(sheetRef.current.querySelectorAll<HTMLElement>(FOCUSABLE));
        if (focusable.length === 0) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        const active = document.activeElement;
        if (event.shiftKey && (active === first || !inside)) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && (active === last || !inside)) {
          event.preventDefault();
          first.focus();
        }
        event.stopPropagation();
        return;
      }
      if (inside) event.stopPropagation();
    };

    window.addEventListener('keydown', onKeyDown, true);
    return () => {
      window.clearTimeout(focusTimer);
      window.removeEventListener('keydown', onKeyDown, true);
    };
  }, [close, open]);

  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          className="phone-sheet-layer"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: reduceMotion ? 0 : 0.2, ease: [0.22, 1, 0.36, 1] }}
        >
          <div className="phone-sheet-scrim" onClick={close} aria-hidden="true" />
          <motion.section
            className="phone-sheet"
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            ref={(node) => { sheetRef.current = node; }}
            initial={{ y: reduceMotion ? 0 : '100%' }}
            animate={{ y: 0 }}
            exit={{ y: reduceMotion ? 0 : '100%' }}
            transition={{ duration: reduceMotion ? 0 : 0.36, ease: [0.22, 1, 0.36, 1] }}
          >
            <header className="phone-sheet-head">
              <h2 id={titleId}>{title}</h2>
              <button className="phone-sheet-close" type="button" onClick={close} ref={closeRef}>
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="m6 6 12 12M18 6 6 18" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="square" />
                </svg>
                <span className="sr-only">닫기</span>
              </button>
            </header>
            <div className="phone-sheet-body">{children}</div>
          </motion.section>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
