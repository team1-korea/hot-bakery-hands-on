'use client';

import { useEffect, useMemo, useRef, useState } from 'react';

import type { CropRect, PhotoSource } from '@/lib/photo';

/** 이보다 더 확대하면 잘라 낼 영역이 너무 작아져 증서가 흐려진다. */
const MAX_ZOOM = 3;

type Point = { x: number; y: number };
type View = { zoom: number; offset: Point };

function clampOffset(offset: number, imageLength: number, frame: number) {
  // 사진이 틀보다 크면 틀을 덮는 범위 안에서, 작으면 남는 빈 자리 안에서 움직인다.
  // 어느 쪽이든 사진이 틀 밖으로 달아나지는 않는다.
  return imageLength >= frame
    ? Math.min(0, Math.max(frame - imageLength, offset))
    : Math.max(0, Math.min(frame - imageLength, offset));
}

function midpoint(points: Point[]): Point {
  const sum = points.reduce((acc, p) => ({ x: acc.x + p.x, y: acc.y + p.y }), { x: 0, y: 0 });
  return { x: sum.x / points.length, y: sum.y / points.length };
}

function spread(points: Point[]) {
  return points.length < 2 ? 0 : Math.hypot(points[0].x - points[1].x, points[0].y - points[1].y);
}

/**
 * 참가자가 사진을 끌고 확대해 정사각 틀에 맞추는 화면.
 *
 * 틀 안에 보이는 것이 그대로 증서가 된다. 바깥을 흐리게 깔아 보여 주는 방식도 있지만,
 * 그러면 "보이는 것 중 어디까지 남는지"를 한 번 더 헤아려야 한다. 남을 것만 보여 주는
 * 편이 발행 직전에 판단하기 쉽다.
 */
export function PhotoCropper({ source, crop, onCrop }: {
  source: PhotoSource;
  crop: CropRect | null;
  onCrop: (rect: CropRect) => void;
}) {
  const frameRef = useRef<HTMLDivElement>(null);
  const [frame, setFrame] = useState(0);

  // 손으로 움직이기 전까지는 null이다. 그동안은 아래 기본 자리를 쓴다.
  const [moved, setMoved] = useState<View | null>(null);
  const pointers = useRef(new Map<number, Point>());

  // 매 움직임마다 부모의 crop이 갱신되므로, 처음 들어온 값만 붙잡아 둔다.
  const [restore] = useState(crop);

  // 틀은 화면 폭을 따라가므로 실제 크기를 재서 좌표 계산에 쓴다.
  useEffect(() => {
    const node = frameRef.current;
    if (!node) return;
    const observer = new ResizeObserver(([entry]) => setFrame(entry.contentRect.width));
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  const baseScale = frame > 0 ? frame / Math.min(source.width, source.height) : 0;

  /*
   * 가장 작게 줄였을 때 사진 전체가 틀에 들어오는 배율.
   *
   * 기본 배율에서는 짧은 변이 틀에 딱 맞아 그 축의 여백이 0이다. 그래서 가로 사진은
   * 좌우로만, 세로 사진은 상하로만 움직인다. 여기까지 줄일 수 있게 하면 두 축 모두
   * 여백이 생겨 사방으로 옮길 수 있고, 사진을 하나도 자르지 않는 선택도 가능해진다.
   */
  const minZoom = Math.min(source.width, source.height) / Math.max(source.width, source.height);

  /** 닉네임 단계에서 돌아왔으면 맞춰 둔 자리로, 아니면 한가운데로. */
  const resting = useMemo<View | null>(() => {
    if (frame === 0) return null;
    const saved = restore;
    if (saved && saved.size > 0) {
      const scale = frame / saved.size;
      return { zoom: scale / baseScale, offset: { x: -saved.sx * scale, y: -saved.sy * scale } };
    }
    return {
      zoom: 1,
      offset: {
        x: (frame - source.width * baseScale) / 2,
        y: (frame - source.height * baseScale) / 2,
      },
    };
  }, [frame, baseScale, restore, source.width, source.height]);

  const view = moved ?? resting;
  const scale = view ? baseScale * view.zoom : 0;

  // 틀 안에 남는 영역을 원본 좌표로 되돌려 부모에게 알린다.
  useEffect(() => {
    if (!view || scale === 0) return;
    onCrop({ sx: -view.offset.x / scale, sy: -view.offset.y / scale, size: frame / scale });
  }, [view, scale, frame, onCrop]);

  const move = (nextZoom: number, from: Point, to: Point) => {
    if (!view) return;
    const bounded = Math.min(MAX_ZOOM, Math.max(minZoom, nextZoom));
    const ratio = bounded / view.zoom;
    const next = baseScale * bounded;
    setMoved({
      zoom: bounded,
      offset: {
        x: clampOffset(to.x - (from.x - view.offset.x) * ratio, source.width * next, frame),
        y: clampOffset(to.y - (from.y - view.offset.y) * ratio, source.height * next, frame),
      },
    });
  };

  const atCover = !view || view.zoom > (1 + minZoom) / 2;

  /** 꽉 채우기와 전체 담기 사이를 오간다. 어느 쪽이든 한가운데에 놓아 결과를 예측하게 한다. */
  const fit = () => {
    const target = atCover ? minZoom : 1;
    const next = baseScale * target;
    setMoved({
      zoom: target,
      offset: {
        x: clampOffset((frame - source.width * next) / 2, source.width * next, frame),
        y: clampOffset((frame - source.height * next) / 2, source.height * next, frame),
      },
    });
  };

  const positionOf = (event: React.PointerEvent) => {
    const box = event.currentTarget.getBoundingClientRect();
    return { x: event.clientX - box.left, y: event.clientY - box.top };
  };

  const onPointerDown = (event: React.PointerEvent) => {
    event.currentTarget.setPointerCapture(event.pointerId);
    pointers.current.set(event.pointerId, positionOf(event));
  };

  const onPointerMove = (event: React.PointerEvent) => {
    if (!view || !pointers.current.has(event.pointerId)) return;
    const before = [...pointers.current.values()];
    pointers.current.set(event.pointerId, positionOf(event));
    const after = [...pointers.current.values()];

    // 손가락 하나면 간격이 0이라 배율은 1, 곧 끌기만 한다.
    const gap = spread(before);
    const ratio = gap > 0 ? spread(after) / gap : 1;
    move(view.zoom * ratio, midpoint(before), midpoint(after));
  };

  const onPointerUp = (event: React.PointerEvent) => {
    pointers.current.delete(event.pointerId);
  };

  return (
    <div className="photo-crop">
      <div
        className="photo-frame"
        ref={frameRef}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        {/* 끌어서 옮기는 대상이라 브라우저 기본 드래그는 꺼 둔다. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={source.url}
          alt="맞추는 중인 쿠키 사진"
          draggable={false}
          style={{
            width: source.width * scale,
            height: source.height * scale,
            transform: `translate(${view?.offset.x ?? 0}px, ${view?.offset.y ?? 0}px)`,
          }}
        />
      </div>

      {/*
        * 크기는 손가락 두 개로 맞춘다. 조절 바를 따로 두면 같은 일을 하는 장치가 둘이 된다.
        * 다만 "틀보다 작게 줄일 수 있다"는 것은 핀치만으로 알기 어려워서, 그 한 가지만
        * 버튼으로 남긴다. 정사각형 사진은 줄여도 달라질 것이 없으므로 내보내지 않는다.
        */}
      {minZoom < 1 ? (
        <button className="photo-fit" type="button" onClick={fit}>
          {atCover ? '사진 전체 담기' : '틀에 꽉 채우기'}
        </button>
      ) : null}
    </div>
  );
}
