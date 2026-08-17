"use client";

import { PillSelectList } from "@/components/ui/PillSelectList";
import type { SchoolSearchResult } from "@/types";

interface SchoolSelectStepProps {
  results: SchoolSearchResult[];
  onSelect: (school: SchoolSearchResult) => void;
}

/**
 * 학교 선택 단계 (BM-103) — 패널 본문만.
 * 공통 골격/뒤로 버튼은 OnboardingFlow가 스캐폴드로 감싼다.
 * 검색 결과를 알약 목록으로 보여준다.
 */
export function SchoolSelectStep({ results, onSelect }: SchoolSelectStepProps) {
  return (
    <div className="flex flex-col items-center gap-5">
      <PillSelectList
        items={results}
        getKey={(s) => s.id}
        getLabel={(s) => s.place}
        onSelect={onSelect}
      />
    </div>
  );
}
