"use client";

import { useEffect, type ReactNode } from "react";
import { useOrientation } from "@/hooks/useOrientation";

/**
 * 가로모드 강제 고정 — 세로 안내 오버레이 대신 **콘텐츠를 90° 회전**해 항상 가로로 보이게 한다.
 *
 *  - Android 전체화면/PWA: enterFullscreen 이 screen.orientation.lock('landscape') 로 진짜 잠금.
 *    이때 OS가 가로를 유지하므로 window 가 계속 가로 → 아래 강제회전은 적용되지 않는다(이중 회전 없음).
 *  - 잠금 미지원(iOS Safari 브라우저 등): 기기가 세로일 때 body 에 `force-landscape` 를 붙여
 *    #app-rotator(globals.css)를 회전시켜 콘텐츠를 landscape 로 채운다.
 *  - children 은 항상 마운트 유지 → 회전해도 앱 상태(온보딩/지도 등)가 보존된다.
 */
export function PortraitGuard({ children }: { children: ReactNode }) {
  const orientation = useOrientation();

  // 지원 기기(주로 Android/설치형)에서 best-effort 가로 잠금.
  useEffect(() => {
    const so = screen.orientation as ScreenOrientation & {
      lock?: (orientation: string) => Promise<void>;
    };
    so?.lock?.("landscape").catch(() => {});
  }, []);

  // 세로일 때만 강제회전 클래스 토글(가로면 #app-rotator 는 display:contents 라 영향 없음).
  useEffect(() => {
    const on = orientation === "portrait";
    document.body.classList.toggle("force-landscape", on);
    return () => document.body.classList.remove("force-landscape");
  }, [orientation]);

  return <div id="app-rotator">{children}</div>;
}
