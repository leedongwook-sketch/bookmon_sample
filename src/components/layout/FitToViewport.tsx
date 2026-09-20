"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

interface FitToViewportProps {
  children: ReactNode;
  /** 최대 배율. 1 = 확대 없이 축소만(스크롤 제거 목적). 1보다 크면 큰 화면에서 확대도 허용. */
  maxScale?: number;
  className?: string;
}

/**
 * 자식(콘텐츠)을 부모 영역에 꽉 맞게 "균일 축소/확대"해 스크롤을 없앤다.
 * - 콘텐츠의 자연 크기를 측정해 가로·세로 둘 다 들어가는 배율로 transform:scale.
 * - 가로모드에서 세로가 짧아 넘치던 화면도 스크롤 없이 통째로 축소돼 들어간다.
 * - transform은 레이아웃 박스를 바꾸지 않으므로 측정은 항상 원본 크기 기준(재귀/루프 없음).
 */
export function FitToViewport({
  children,
  maxScale = 1,
  className,
}: FitToViewportProps) {
  const outerRef = useRef<HTMLDivElement>(null);
  const innerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  const [ready, setReady] = useState(false); // 첫 측정 전 깜빡임 방지

  useEffect(() => {
    const outer = outerRef.current;
    const inner = innerRef.current;
    if (!outer || !inner) return;

    const compute = () => {
      const availW = outer.clientWidth;
      const availH = outer.clientHeight;
      const contentW = inner.offsetWidth; // transform 영향 없음(원본 크기)
      const contentH = inner.offsetHeight;
      if (!availW || !availH || !contentW || !contentH) return;
      const next = Math.min(availW / contentW, availH / contentH, maxScale);
      setScale(next > 0 ? next : 1);
      setReady(true);
    };

    const ro = new ResizeObserver(compute);
    ro.observe(outer);
    ro.observe(inner);
    compute();
    return () => ro.disconnect();
  }, [maxScale]);

  return (
    <div
      ref={outerRef}
      className={`relative h-full w-full overflow-hidden ${className ?? ""}`}
    >
      <div
        ref={innerRef}
        className="absolute left-1/2 top-1/2"
        style={{
          transform: `translate(-50%, -50%) scale(${scale})`,
          transformOrigin: "center center",
          opacity: ready ? 1 : 0,
        }}
      >
        {children}
      </div>
    </div>
  );
}
