"use client";

import type { ReactNode } from "react";

/**
 * 앱 전역 프로바이더 묶음.
 * 지금은 통과(pass-through)이며, 이후 단계에서 다음을 여기에 감싼다:
 *   - React Query (QueryClientProvider) — 서버 데이터 캐싱
 *   - 전역 상태(Zustand) 초기화 — 필요 시
 * 클라이언트 경계이므로 서버 컴포넌트인 layout.tsx에서 이 컴포넌트로 감싼다.
 */
export function Providers({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
