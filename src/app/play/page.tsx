"use client";

import dynamic from "next/dynamic";

// 실행모드 지도는 geolocation/persist 스토어 등 브라우저 전용이라 SSR/프리렌더 비활성(ssr:false).
// ssr:false 는 클라이언트 컴포넌트에서만 동작하므로 이 페이지를 'use client' 로 둔다.
const PracticeMapScreen = dynamic(
  () =>
    import("@/features/practice/PracticeMapScreen").then(
      (m) => m.PracticeMapScreen
    ),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-[100dvh] w-full items-center justify-center bg-[#e7e3d8] text-sm font-semibold text-navy/70">
        지도를 불러오는 중…
      </div>
    ),
  }
);

// 실행모드 — 최초 GPS 픽스 기준 고정 이미지 지도(용인초 일러스트) + 주변 랜덤 몬스터.
export default function PlayPage() {
  return <PracticeMapScreen />;
}
