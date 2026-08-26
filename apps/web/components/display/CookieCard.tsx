'use client';

import { motion, useReducedMotion } from 'framer-motion';
import Image from 'next/image';
import { useEffect, useRef, useState } from 'react';

import type { Entry } from '@/lib/api/types';

import type { CardMotionPhase } from './displaySequence';
import {
  CARD_DROP_DURATION,
  CARD_MOVE_DURATION,
  EASE_IMPACT,
  EASE_MOVE,
  EASE_SETTLE,
} from './motion';

const STATUS_LABEL = {
  JOINED: '사진 기다리는 중',
  SUBMITTED: '사진 도착',
  PINNED: '굽기 대기',
  MINTING: '굽는 중',
  MINTED: '진열 완료',
  FAILED: '다시 확인',
} as const;

/** Storage/CDN 전파가 잠깐 늦어도 오븐에서 증서가 영구히 사라지지 않게 제한적으로 재시도한다. */
const IMAGE_RETRY_DELAYS = [600, 1_200] as const;

function retryImageUrl(url: string, attempt: number) {
  if (attempt === 0) return url;
  const hashIndex = url.indexOf('#');
  const base = hashIndex < 0 ? url : url.slice(0, hashIndex);
  const hash = hashIndex < 0 ? '' : url.slice(hashIndex);
  return `${base}${base.includes('?') ? '&' : '?'}bakery_retry=${attempt}${hash}`;
}

function imageNumber(entry: Entry) {
  const value = Number(entry.id.replace(/\D/g, ''));
  return Number.isFinite(value) ? value : 1;
}

export function CookieCard({
  entry,
  motionPhase,
  layoutDuration,
  layoutEase,
}: {
  entry: Entry;
  motionPhase?: CardMotionPhase;
  layoutDuration?: number;
  layoutEase?: [number, number, number, number];
}) {
  const reduceMotion = useReducedMotion();
  const minted = entry.status === 'MINTED';
  const imageUrl = entry.photoUrl;
  const [loadedImageUrl, setLoadedImageUrl] = useState<string | null>(null);
  const imageLoaded = Boolean(imageUrl) && loadedImageUrl === imageUrl;
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
        className={`cookie-card ${minted ? 'certificate-card' : 'photo-card'} ${imageLoaded ? 'has-certificate-image' : ''}`}
        data-status={entry.status}
      >
        <div className="card-media">
          {minted ? <CertificatePlaceholder variation={variation} /> : <CookiePlaceholder variation={variation} />}
          {imageUrl ? (
            <RetryingCertificateImage
              key={imageUrl}
              src={imageUrl}
              alt={`${entry.nickname}의 참가증서`}
              eager={(entry.shelfIndex ?? 15) < 3}
              onLoad={() => setLoadedImageUrl(imageUrl)}
            />
          ) : null}
          {!minted ? <span className="status-ticket">{STATUS_LABEL[entry.status]}</span> : null}
        </div>
        {minted ? (
          <div className="card-caption certificate-caption">
            <strong>#{entry.tokenId}</strong>
            <span className="card-nickname">{entry.nickname}</span>
          </div>
        ) : (
          <div className="card-caption">
            <strong>{entry.nickname}</strong>
          </div>
        )}
      </motion.article>
    </motion.div>
  );
}

function RetryingCertificateImage({
  src,
  alt,
  eager,
  onLoad,
}: {
  src: string;
  alt: string;
  eager: boolean;
  onLoad: () => void;
}) {
  const [attempt, setAttempt] = useState(0);
  const [waiting, setWaiting] = useState(false);
  const [failed, setFailed] = useState(false);
  const retryTimer = useRef<number | null>(null);

  useEffect(() => () => {
    if (retryTimer.current !== null) window.clearTimeout(retryTimer.current);
  }, []);

  if (waiting || failed) return null;

  return (
    <Image
      src={retryImageUrl(src, attempt)}
      alt={alt}
      fill
      unoptimized
      sizes="320px"
      loading={eager ? 'eager' : 'lazy'}
      onLoad={onLoad}
      onError={() => {
        const delay = IMAGE_RETRY_DELAYS[attempt];
        if (delay === undefined) {
          setFailed(true);
          return;
        }
        setWaiting(true);
        retryTimer.current = window.setTimeout(() => {
          retryTimer.current = null;
          setAttempt((current) => current + 1);
          setWaiting(false);
        }, delay);
      }}
    />
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
