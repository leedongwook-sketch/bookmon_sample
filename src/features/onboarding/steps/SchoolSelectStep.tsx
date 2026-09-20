"use client";

import { PillSelectList } from "@/components/ui/PillSelectList";
import type { SchoolSearchResult } from "@/types";

interface SchoolSelectStepProps {
  results: SchoolSearchResult[];
  selectedKey?: string; // 선택(하이라이트)된 학교 id — 클릭 시 파란 선택 표시
  onSelect: (school: SchoolSearchResult) => void;
}

/**
 * 학교 선택 단계 (BM-103) — 패널 본문만.
 * 목록 클릭 = 파란 선택 하이라이트만(pendingSchool). 확정/이동은 스캐폴드 "다음" 버튼에서.
 */
export function SchoolSelectStep({
  results,
  selectedKey,
  onSelect,
}: SchoolSelectStepProps) {
  return (
    <div className="flex w-full flex-col items-center gap-5">
      <PillSelectList
        items={results}
        getKey={(s) => s.id}
        getLabel={(s) => s.place}
        selectedKey={selectedKey}
        onSelect={onSelect}
      />
    </div>
  );
}
