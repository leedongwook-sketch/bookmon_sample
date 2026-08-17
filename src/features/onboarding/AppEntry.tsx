"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { BootSplash } from "@/components/layout/BootSplash";
import {
  readSavedGameState,
  isValidGameState,
  isPlayableGameState,
  clearSavedGameState,
} from "@/lib/gameSession";
import { OnboardingFlow } from "./OnboardingFlow";

/**
 * 앱 진입 공통 게이트.
 *  1) localStorage("bookmon-game") 검사
 *  2) 없음 → 온보딩(모드선택 BM-101 →…)
 *  3) 있음 → GameState 구조 검증
 *       - 정상(플레이 가능) 데이터 → /map 이동
 *       - 손상 데이터 → 정리 후 온보딩
 *       - 유효하나 미완(모드만 선택 등) → 온보딩
 *
 * 게이트 통과 후의 온보딩 UI(모드선택 + 학교 단계)는 OnboardingFlow가 담당한다.
 * OnboardingFlow가 스캐폴드(배경/로고)를 한 번만 렌더하며 단계를 전환한다.
 */
export function AppEntry() {
  const router = useRouter();
  const [ready, setReady] = useState(false); // false = 검사 중(스플래시)

  useEffect(() => {
    const saved = readSavedGameState();

    if (saved !== null && !isValidGameState(saved)) {
      clearSavedGameState(); // 구조 손상 → 정리
    } else if (isPlayableGameState(saved)) {
      router.replace("/map"); // 정상 게임데이터 → 지도로
      return; // 스플래시 유지한 채 이동
    }

    // localStorage는 클라이언트에서만 접근 가능 → 마운트 후 검사해 노출 결정(의도된 패턴)
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setReady(true); // 그 외 → 온보딩 노출
  }, [router]);

  if (!ready) return <BootSplash />;
  return <OnboardingFlow />;
}
