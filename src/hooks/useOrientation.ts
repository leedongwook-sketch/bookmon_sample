"use client";

import { useEffect, useState } from "react";

export type Orientation = "landscape" | "portrait";

/**
 * 현재 화면 방향을 반환한다. (가로/세로)
 * 화면을 "강제 회전"하지 않고, 각 화면이 방향에 맞게 레이아웃을 바꿀 수 있도록
 * 방향 정보만 제공한다. → 세로에서도 왜곡 없이 대응.
 */
export function useOrientation(): Orientation {
  const [orientation, setOrientation] = useState<Orientation>("landscape");

  useEffect(() => {
    const compute = () =>
      setOrientation(
        window.innerWidth >= window.innerHeight ? "landscape" : "portrait"
      );

    compute();
    window.addEventListener("resize", compute);
    window.addEventListener("orientationchange", compute);
    return () => {
      window.removeEventListener("resize", compute);
      window.removeEventListener("orientationchange", compute);
    };
  }, []);

  return orientation;
}
