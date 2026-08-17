"use client";

import { useRouter } from "next/navigation";
import { useGameStore } from "@/store/gameStore";
import { MODE_OPTIONS, type ModeOption } from "./modes";
import { ModeCard } from "./components/ModeCard";
import { OnboardingScaffold } from "./components/OnboardingScaffold";

interface ModeSelectScreenProps {
  // 실전(행사)모드 선택 시 호출 — 라우트 이동 대신 / 페이지 안에서 학교 단계로 전환.
  onSelectReal: () => void;
}

/**
 * BM-101 실행모드 선택 (앱 최초 진입 화면).
 * 흐름: 모드 선택 → 스토어에 mode 저장 →
 *   체험(next 있음)은 해당 라우트로 이동, 실전은 onSelectReal로 페이지 내 단계 전환.
 */
export function ModeSelectScreen({ onSelectReal }: ModeSelectScreenProps) {
  const router = useRouter();
  const setMode = useGameStore((s) => s.setMode);

  const handleSelect = (option: ModeOption) => {
    setMode(option.mode); // 선택 결과를 전역 상태(+localStorage)에 저장
    if (option.next) {
      router.push(option.next); // 체험모드 → 지도로 이동
    } else {
      onSelectReal(); // 실전모드 → 같은 페이지에서 학교 선택 단계로
    }
  };

  return (
    <OnboardingScaffold banner="실행모드를 선택해 주세요">
      <div className="flex flex-wrap items-center justify-center gap-4 sm:gap-6">
        {MODE_OPTIONS.map((option) => (
          <ModeCard key={option.mode} option={option} onSelect={handleSelect} />
        ))}
      </div>
    </OnboardingScaffold>
  );
}
