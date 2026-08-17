"use client";

import { useOnboardingFlow } from "./hooks/useOnboardingFlow";
import { SchoolInputStep } from "./steps/SchoolInputStep";
import { SchoolSelectStep } from "./steps/SchoolSelectStep";
import { GroupSelectStep } from "./steps/GroupSelectStep";

interface SchoolSearchScreenProps {
  // BM-102(학교 입력)의 뒤로 목적지 = 모드선택(BM-101). AppEntry가 step을 되돌린다.
  onBackToModeSelect: () => void;
}

/**
 * 실전모드 온보딩 오케스트레이터 — 학교 입력(BM-102) → 학교 선택(BM-103) → 모둠 선택(BM-104).
 * 상태·로직은 useOnboardingFlow가 담고, 여기서는 흐름 상태를 보고 어느 단계를 그릴지만 결정한다.
 *
 * 단계 우선순위: 학교 확정 시 모둠 선택 > 검색 결과 있으면 학교 선택 > 그 외 학교 입력.
 *
 * 뒤로(좌상단 버튼) 목적지 배선: BM-104→BM-103, BM-103→BM-102, BM-102→BM-101.
 */
export function SchoolSearchScreen({
  onBackToModeSelect,
}: SchoolSearchScreenProps) {
  const flow = useOnboardingFlow();

  // 1) 모둠 선택 (BM-104): 학교를 확정한 뒤 — 뒤로 → 학교 선택(BM-103)
  if (flow.selectedSchool) {
    return (
      <GroupSelectStep
        group={flow.group}
        selectedGroup={flow.selectedGroup}
        onSelectGroup={flow.handleSelectGroup}
        starting={flow.starting}
        startError={flow.startError}
        onStart={flow.handleStart}
        onBack={flow.handleBackToSchoolSelect}
      />
    );
  }

  // 2) 학교 선택 (BM-103): 검색 결과가 있을 때 — 뒤로 → 학교 입력(BM-102, 검색결과 비움)
  if (flow.schoolSelecting) {
    return (
      <SchoolSelectStep
        results={flow.school.results}
        onSelect={flow.handleSelectSchool}
        onBack={flow.school.reset}
      />
    );
  }

  // 3) 학교 입력 (BM-102): 최초 진입 기본 단계 — 뒤로 → 모드선택(BM-101)
  return (
    <SchoolInputStep
      keyword={flow.keyword}
      onKeywordChange={flow.setKeyword}
      searchStatus={flow.school.status}
      hasNoResult={
        flow.school.status === "success" && flow.school.results.length === 0
      }
      onSubmit={flow.handleSearch}
      onBack={onBackToModeSelect}
    />
  );
}
