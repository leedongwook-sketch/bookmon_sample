"use client";

import { useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useGameStore } from "@/store/gameStore";
import { OnboardingScaffold } from "./components/OnboardingScaffold";
import { CtaButton } from "./components/CtaButton";
import { ModeCard } from "./components/ModeCard";
import { MODE_OPTIONS, type ModeOption } from "./modes";
import { useOnboardingFlow } from "./hooks/useOnboardingFlow";
import { SchoolInputStep } from "./steps/SchoolInputStep";
import { SchoolSelectStep } from "./steps/SchoolSelectStep";
import { GroupSelectStep } from "./steps/GroupSelectStep";

// 온보딩 최상위 단계. mode-select(BM-101) → (실전 선택 시) school(BM-102~104).
// 체험모드는 여기서 라우트 이동(/map)하므로 school로 넘어오지 않는다.
type TopStep = "mode-select" | "school";

// 스캐폴드가 화면별로 갈아끼우는 부분만 모은 뷰 기술.
interface StepView {
  banner: string;
  body: ReactNode;
  footer?: ReactNode;
  onBack?: () => void;
}

/**
 * 온보딩 오케스트레이터 — 배경/로고/패널 골격(OnboardingScaffold)을 **한 번만** 렌더하고,
 * 단계가 바뀌면 배너·본문·footer·뒤로만 교체한다.
 *
 * 왜 이렇게 하나: 예전에는 각 단계 컴포넌트가 스캐폴드를 각자 렌더해, 단계 전환마다
 * 스캐폴드(로고 img 포함)가 통째로 언마운트→리마운트되며 로고가 깜빡였다.
 * 스캐폴드를 이 상위로 끌어올려 계속 마운트 상태로 유지하면 로고/배경은 재로드되지 않는다.
 * (FitToViewport도 유지돼 opacity 페이드가 재생되지 않는다.)
 */
export function OnboardingFlow() {
  const router = useRouter();
  const setMode = useGameStore((s) => s.setMode);
  const [step, setStep] = useState<TopStep>("mode-select");
  const flow = useOnboardingFlow();

  const handleSelectMode = (option: ModeOption) => {
    setMode(option.mode); // 선택 결과를 전역 상태(+localStorage)에 저장
    if (option.next) {
      router.push(option.next); // 체험모드 → 지도로 이동
    } else {
      setStep("school"); // 실전모드 → 같은 스캐폴드 안에서 학교 단계로
    }
  };

  const view = resolveView();
  return (
    <OnboardingScaffold
      banner={view.banner}
      footer={view.footer}
      onBack={view.onBack}
    >
      {view.body}
    </OnboardingScaffold>
  );

  // 현재 단계에 맞는 배너/본문/footer/뒤로를 계산한다.
  // 단계 우선순위(school): 학교 확정 시 모둠 선택 > 검색 결과 있으면 학교 선택 > 그 외 학교 입력.
  function resolveView(): StepView {
    // BM-101 실행모드 선택 (뒤로/footer 없음 = 최초 진입)
    if (step === "mode-select") {
      return {
        banner: "실행모드를 선택해 주세요",
        body: (
          <div className="flex flex-wrap items-center justify-center gap-4 sm:gap-6">
            {MODE_OPTIONS.map((option) => (
              <ModeCard
                key={option.mode}
                option={option}
                onSelect={handleSelectMode}
              />
            ))}
          </div>
        ),
      };
    }

    // BM-104 모둠 선택: 학교 확정 후 — 뒤로 → 학교 선택(BM-103)
    if (flow.selectedSchool) {
      return {
        banner: "모둠 번호를 선택해 주세요",
        onBack: flow.handleBackToSchoolSelect,
        // 시작 버튼은 항상 활성 표시(딤 X) — 미선택 클릭은 handleStart가 무시.
        footer: (
          <CtaButton onClick={flow.handleStart}>
            {flow.starting ? "불러오는 중…" : "시작"}
          </CtaButton>
        ),
        body: (
          <GroupSelectStep
            group={flow.group}
            selectedGroup={flow.selectedGroup}
            onSelectGroup={flow.handleSelectGroup}
            startError={flow.startError}
          />
        ),
      };
    }

    // BM-103 학교 선택: 검색 결과가 있을 때 — 뒤로 → 학교 입력(BM-102, 검색결과 비움)
    if (flow.schoolSelecting) {
      return {
        banner: "학교이름을 선택해 주세요",
        onBack: flow.school.reset,
        footer: <CtaButton onClick={flow.school.reset}>뒤로</CtaButton>,
        body: (
          <SchoolSelectStep
            results={flow.school.results}
            onSelect={flow.handleSelectSchool}
          />
        ),
      };
    }

    // BM-102 학교 입력: 학교 단계 기본 — 뒤로 → 모드선택(BM-101)
    return {
      banner: "학교이름을 입력해 주세요",
      onBack: () => setStep("mode-select"),
      // 다음/검색중 모두 같은 CtaButton. 폼 밖이지만 form 속성으로 제출 연결.
      footer: (
        <CtaButton type="submit" form="school-input-form">
          {flow.school.status === "loading" ? "검색 중…" : "다음"}
        </CtaButton>
      ),
      body: (
        <SchoolInputStep
          keyword={flow.keyword}
          onKeywordChange={flow.setKeyword}
          searchStatus={flow.school.status}
          hasNoResult={
            flow.school.status === "success" && flow.school.results.length === 0
          }
          onSubmit={flow.handleSearch}
        />
      ),
    };
  }
}
