"use client";

import { useEffect, type ReactNode } from "react";
import { useOrientation } from "@/hooks/useOrientation";

/**
 * 가로모드 고정(범용 방식).
 *
 * 모바일 브라우저는 하드웨어 방향을 진짜로 잠글 수 없다(특히 iOS Safari).
 * 그래서 세로일 때 "가로로 돌려주세요" 오버레이로 앱을 덮고, 가로가 되면 자동으로 걷는다.
 *  - 매니페스트 orientation:landscape(설치형 PWA) + 아래 best-effort 잠금은 지원 기기에서만 동작,
 *    미지원 환경은 이 오버레이로 커버 → 브라우저·PWA·iOS·Android 어디서나 동일하게 가로 유도.
 *  - children 은 항상 마운트 유지 → 회전해도 앱 상태(온보딩 단계/지도 등)가 보존된다.
 */
export function PortraitGuard({ children }: { children: ReactNode }) {
  const orientation = useOrientation();

  // 지원 기기(주로 Android/Chrome·설치형)에서만 가로 잠금 시도. 미지원/거부는 조용히 무시.
  useEffect(() => {
    const so = screen.orientation as ScreenOrientation & {
      lock?: (orientation: string) => Promise<void>;
    };
    so?.lock?.("landscape").catch(() => {});
  }, []);

  return (
    <>
      {children}
      {orientation === "portrait" && <RotateOverlay />}
    </>
  );
}

// 세로일 때 앱을 덮는 안내 오버레이. 최상단(z-[100])으로 AR·지도 등 모든 레이어 위에 올린다.
function RotateOverlay() {
  return (
    <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center gap-5 bg-ivory px-8 text-center">
      <RotateIcon />
      <div className="flex flex-col items-center gap-1.5">
        <p className="text-xl font-extrabold text-navy">
          화면을 가로로 돌려주세요
        </p>
        <p className="text-sm text-navy/70">
          북몬은 가로 모드에서 즐길 수 있어요.
        </p>
      </div>
    </div>
  );
}

// 회전 힌트 아이콘 — 살짝 기울어지며 도는 스마트폰(세로→가로) 모션.
function RotateIcon() {
  return (
    <div className="animate-[rotateHint_2s_ease-in-out_infinite]">
      <svg
        viewBox="0 0 24 24"
        className="h-16 w-16"
        fill="none"
        stroke="#12213a"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <rect x="7" y="2.5" width="10" height="19" rx="2" />
        <line x1="7" y1="18" x2="17" y2="18" />
      </svg>
      <style>{`
        @keyframes rotateHint {
          0%, 100% { transform: rotate(0deg); }
          50% { transform: rotate(-90deg); }
        }
      `}</style>
    </div>
  );
}
