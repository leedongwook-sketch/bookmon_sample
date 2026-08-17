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
import { ModeSelectScreen } from "./ModeSelectScreen";
import { SchoolSearchScreen } from "./SchoolSearchScreen";

// 게이트 통과 후 / 페이지에서 보여줄 온보딩 단계.
// mode-select(BM-101) → (실전 선택 시) school(BM-102~104). 체험은 /map으로 라우트 이동.
type OnboardingStep = "mode-select" | "school";

/**
 * 앱 진입 공통 게이트.
 *  1) localStorage("bookmon-game") 검사
 *  2) 없음 → 모드선택(BM-101)
 *  3) 있음 → GameState 구조 검증
 *       - 정상(플레이 가능) 데이터 → /map 이동
 *       - 손상 데이터 → 정리 후 모드선택
 *       - 유효하나 미완(모드만 선택 등) → 모드선택
 *
 * 실전모드 선택 시 라우트 이동 없이 같은 페이지에서 school 단계로 전환한다
 * (기존 /onboarding/school 라우트를 통합).
 */
export function AppEntry() {
  const router = useRouter();
  const [ready, setReady] = useState(false); // false = 검사 중(스플래시)
  const [step, setStep] = useState<OnboardingStep>("mode-select");

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
    setReady(true); // 그 외 → 모드선택 노출
  }, [router]);

  if (!ready) return <BootSplash />;
  if (step === "school")
    return (
      <SchoolSearchScreen onBackToModeSelect={() => setStep("mode-select")} />
    );
  return <ModeSelectScreen onSelectReal={() => setStep("school")} />;
}
