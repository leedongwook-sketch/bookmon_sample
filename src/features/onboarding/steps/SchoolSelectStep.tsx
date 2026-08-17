"use client";

import { OnboardingScaffold } from "../components/OnboardingScaffold";
import { CtaButton } from "../components/CtaButton";
import { PillSelectList } from "@/components/ui/PillSelectList";
import type { SchoolSearchResult } from "@/types";

interface SchoolSelectStepProps {
  results: SchoolSearchResult[];
  onSelect: (school: SchoolSearchResult) => void;
  onBack: () => void; // 검색 결과 초기화 → 입력 단계로 복귀
}

/**
 * 학교 선택 단계 (BM-103).
 * 검색 결과를 알약 목록으로 보여주고, "뒤로"로 입력 단계로 되돌린다.
 */
export function SchoolSelectStep({
  results,
  onSelect,
  onBack,
}: SchoolSelectStepProps) {
  return (
    <OnboardingScaffold
      banner="학교이름을 선택해 주세요"
      // 좌상단 뒤로 버튼과 하단 걸침 "뒤로" CTA 모두 같은 목적지(BM-102, 검색결과 비움)
      onBack={onBack}
      // 뒤로 버튼도 다음 버튼과 동일 프레임(CtaButton) + 하단 걸침
      footer={<CtaButton onClick={onBack}>뒤로</CtaButton>}
    >
      <div className="flex flex-col items-center gap-5">
        <PillSelectList
          items={results}
          getKey={(s) => s.id}
          getLabel={(s) => s.place}
          onSelect={onSelect}
        />
      </div>
    </OnboardingScaffold>
  );
}
