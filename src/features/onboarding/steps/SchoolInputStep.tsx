"use client";

import { Notice } from "./Notice";
import { ASSETS } from "@/constants/assets";
import type { useOnboardingFlow } from "../hooks/useOnboardingFlow";

type Flow = ReturnType<typeof useOnboardingFlow>;

interface SchoolInputStepProps {
  keyword: Flow["keyword"];
  onKeywordChange: (value: string) => void;
  searchStatus: Flow["school"]["status"];
  hasNoResult: boolean; // 검색 성공했으나 결과 0건
  onSubmit: Flow["handleSearch"];
}

/**
 * 학교 입력 단계 (BM-102) — 패널 본문만.
 * 공통 골격(배경/로고/패널/뒤로·다음 버튼)은 OnboardingFlow가 스캐폴드로 감싸 유지한다.
 * 검색바 + 폼. "다음"(검색) 버튼은 스캐폴드 footer가 form="school-input-form"으로 제출 연결한다.
 */
export function SchoolInputStep({
  keyword,
  onKeywordChange,
  searchStatus,
  hasNoResult,
  onSubmit,
}: SchoolInputStepProps) {
  return (
    <form
      id="school-input-form"
      onSubmit={onSubmit}
      className="flex flex-col items-center gap-4"
    >
      {/* 검색바: searchbar_frame.svg(프레임+돋보기) 배경 + 실제 input(placeholder는 코드가 담당) */}
      <input
        type="text"
        value={keyword}
        onChange={(e) => onKeywordChange(e.target.value)}
        placeholder="학교명 검색"
        aria-label="학교명 검색"
        style={{
          backgroundImage: `url(${ASSETS.searchBar})`,
          backgroundSize: "100% 100%",
          backgroundRepeat: "no-repeat",
        }}
        className="h-[42px] w-[min(86vw,376px)] rounded-[10px] bg-transparent pl-12 pr-4 text-base text-navy placeholder:text-[#898989] outline-none"
      />

      {hasNoResult && (
        <Notice>검색 결과가 없습니다. 학교이름을 다시 확인해 주세요.</Notice>
      )}
      {searchStatus === "error" && (
        <Notice>연결이 불안정합니다. 다시 시도해 주세요.</Notice>
      )}
    </form>
  );
}
