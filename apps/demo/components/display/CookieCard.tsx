'use client';

import { motion, useReducedMotion } from 'framer-motion';
import Image from 'next/image';

import type { Entry } from '@/lib/types';

import type { CardMotionPhase } from './displaySequence';
import {
  CARD_DROP_DURATION,
  CARD_MOVE_DURATION,
  EASE_IMPACT,
  EASE_MOVE,
  EASE_SETTLE,
} from './motion';

const STATUS_LABEL = {
  SUBMITTED: '사진 도착',
  RENDERED: '증서 준비',
  PINNED: '굽기 대기',
  MINTING: '굽는 중',
  MINTED: '진열 완료',
  FAILED: '다시 확인',
} as const;

function imageNumber(entry: Entry) {
  const value = Number(entry.id.replace(/\D/g, ''));
  return Number.isFinite(value) ? value : 1;
}

export function CookieCard({
  entry,
  motionPhase,
  layoutDuration,
  layoutEase,
  recordLink = false,
}: {
  entry: Entry;
  motionPhase?: CardMotionPhase;
  layoutDuration?: number;
  layoutEase?: [number, number, number, number];
  recordLink?: boolean;
}) {
  const reduceMotion = useReducedMotion();
  const minted = entry.status === 'MINTED';
  const imageUrl = minted ? entry.certificateUrl : entry.photoUrl;
  const variation = ((imageNumber(entry) - 1) % 15) + 1;
  const innerInitial = reduceMotion ? false
    : motionPhase === 'enter' ? { y: -28, scale: 1, rotate: 0 }
      : false;
  const innerAnimate = reduceMotion
    ? { y: 0 }
    : motionPhase === 'enter'
      ? { y: [-28, 0, -8, 0], scale: 1, rotate: 0 }
      : { y: 0 };
  const innerTransition = motionPhase === 'enter'
    ? {
        y: {
          duration: reduceMotion ? 0 : CARD_DROP_DURATION,
          times: [0, 0.52, 0.74, 1],
          ease: [EASE_IMPACT, EASE_SETTLE, EASE_SETTLE],
        },
      }
    : { duration: 0 };

  return (
    <motion.div
      layout
      layoutId={entry.id}
      initial={false}
      className={`cookie-card-layout ${motionPhase ? `motion-${motionPhase}` : ''}`}
      transition={{
        layout: {
          duration: reduceMotion ? 0 : (layoutDuration ?? CARD_MOVE_DURATION),
          ease: layoutEase ?? EASE_MOVE,
        },
      }}
    >
      <motion.article
        initial={innerInitial}
        animate={innerAnimate}
        transition={innerTransition}
        className={`cookie-card ${minted ? 'certificate-card' : 'photo-card'}`}
        data-status={entry.status}
      >
        <div className="card-media">
          {minted ? <CertificatePlaceholder variation={variation} /> : <CookiePlaceholder variation={variation} />}
          {imageUrl ? (
            <Image
              src={imageUrl}
              alt={minted ? `${entry.nickname}의 참가증서` : `${entry.nickname}의 쿠키`}
              fill
              unoptimized
              sizes="320px"
              loading={(entry.shelfIndex ?? 15) < 3 ? 'eager' : 'lazy'}
              onError={(event) => { event.currentTarget.style.display = 'none'; }}
            />
          ) : null}
          <span className={`status-ticket ${recordLink ? 'is-record-link' : ''}`}>
            {recordLink ? '발행 기록' : STATUS_LABEL[entry.status]}
          </span>
        </div>
        <div className="card-caption">
          {minted ? (
            <><strong>#{entry.tokenId}</strong><span className="card-nickname">{entry.nickname}</span></>
          ) : (
            <strong>{entry.nickname}</strong>
          )}
        </div>
      </motion.article>
    </motion.div>
  );
}

function CookiePlaceholder({ variation }: { variation: number }) {
  return (
    <div className="cookie-placeholder" aria-hidden="true">
      <span className={`cookie-shape cookie-variant-${variation}`}><i /><i /><i /><i /></span>
    </div>
  );
}

function CertificatePlaceholder({ variation }: { variation: number }) {
  return (
    <div className="certificate-placeholder" aria-hidden="true">
      <span className={`certificate-cookie cookie-variant-${variation}`}><i /><i /><i /></span>
      <span className="certificate-lines" />
    </div>
  );
}
