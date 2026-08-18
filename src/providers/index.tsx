"use client";

import type { ReactNode } from "react";
import { PortraitGuard } from "@/components/layout/PortraitGuard";

/**
 * 앱 전역 프로바이더 묶음.
 *   - PortraitGuard — 가로모드 고정(세로 시 회전 안내 오버레이). 전 화면 공통.
 * 이후 단계에서 다음도 여기에 감쌀 수 있다:
 *   - React Query (QueryClientProvider) — 서버 데이터 캐싱
 *   - 전역 상태(Zustand) 초기화 — 필요 시
 * 클라이언트 경계이므로 서버 컴포넌트인 layout.tsx에서 이 컴포넌트로 감싼다.
 */
export function Providers({ children }: { children: ReactNode }) {
  return <PortraitGuard>{children}</PortraitGuard>;
}
