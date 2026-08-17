"use client";

import { OnboardingScaffold } from "../components/OnboardingScaffold";
import { CtaButton } from "../components/CtaButton";
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
  onBack: () => void; // 좌상단 뒤로 → 모드선택(BM-101)
}

/**
 * 학교 입력 단계 (BM-102).
 * 검색바 + "다음"(검색) 버튼. 폼 제출로 검색을 트리거한다.
 */
export function SchoolInputStep({
  keyword,
  onKeywordChange,
  searchStatus,
  hasNoResult,
  onSubmit,
  onBack,
}: SchoolInputStepProps) {
  return (
    <OnboardingScaffold
      banner="학교이름을 입력해 주세요"
      onBack={onBack}
      // 다음/검색중 모두 같은 CtaButton(프레임 공유). 폼 밖이지만 form 속성으로 제출 연결.
      // 검색 중에도 활성 디자인 유지 — 중복 검색은 onSubmit에서 차단.
      footer={
        <CtaButton type="submit" form="school-input-form">
          {searchStatus === "loading" ? "검색 중…" : "다음"}
        </CtaButton>
      }
    >
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
    </OnboardingScaffold>
  );
}
