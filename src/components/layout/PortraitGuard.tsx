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

  // 가로 잠금 — 마운트 시 + 회전/전체화면 변화 때마다 재시도(Android 전체화면에서 회전 방지 강화).
  //   전체화면/설치형에서만 실제로 먹고, 브라우저 탭·iOS 는 거부됨(그 경우 아래 force-landscape 로 커버).
  useEffect(() => {
    const so = screen.orientation as ScreenOrientation & {
      lock?: (orientation: string) => Promise<void>;
    };
    const relock = () => {
      try {
        so?.lock?.("landscape").catch(() => {});
      } catch {
        /* 미지원/거부 → 무시 */
      }
    };
    relock();
    // 세로로 돌리려 하면(orientationchange) 즉시 다시 가로로 잠가 튕겨 돌아오게 한다.
    so?.addEventListener?.("change", relock);
    window.addEventListener("orientationchange", relock);
    document.addEventListener("fullscreenchange", relock);
    return () => {
      so?.removeEventListener?.("change", relock);
      window.removeEventListener("orientationchange", relock);
      document.removeEventListener("fullscreenchange", relock);
    };
  }, []);

  // 세로일 때만 강제회전 클래스 토글(잠금 미지원 환경 폴백). 가로면 #app-rotator 는 display:contents.
  useEffect(() => {
    const on = orientation === "portrait";
    document.body.classList.toggle("force-landscape", on);
    return () => document.body.classList.remove("force-landscape");
  }, [orientation]);

  return <div id="app-rotator">{children}</div>;
}
