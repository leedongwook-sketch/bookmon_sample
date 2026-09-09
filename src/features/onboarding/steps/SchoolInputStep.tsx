"use client";

import { useState } from "react";
import { Notice } from "./Notice";
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
  // 빈 입력으로 "다음" 제출 시: 검색 대신 검색창을 좌우로 흔들어(shake) 유효성 피드백.
  const [shake, setShake] = useState(false);
  const handleSubmit: typeof onSubmit = (e) => {
    if (!keyword.trim()) {
      e.preventDefault();
      setShake(true);
      return;
    }
    onSubmit(e);
  };

  return (
    <form
      id="school-input-form"
      onSubmit={handleSubmit}
      className="flex w-full flex-col items-center gap-4"
    >
      {/* 검색바: 참고 이미지 실측 재현 — 크림 면(#fff3da) + 로열블루 테두리(#366ab4),
          왼쪽에 블루 돋보기 아이콘, placeholder "학교명 검색"(블루). */}
      {/* 피그마(스케일 0.332): h 204→68, radius 50→17, border 12→4px, bg #FFF3DA, border #366AB4.
          빈 입력 제출 시 shake(좌우 4회) 유효성 모션. 애니메이션 끝나면 상태 리셋. */}
      <div
        className={`relative w-full ${shake ? "animate-[shakeX_0.4s_ease-in-out]" : ""}`}
        onAnimationEnd={() => setShake(false)}
      >
        <SearchIcon />
        <input
          type="text"
          value={keyword}
          onChange={(e) => onKeywordChange(e.target.value)}
          placeholder="학교명 검색"
          aria-label="학교명 검색"
          className="h-[68px] w-full rounded-[17px] border-[4px] border-[#366ab4] bg-[#fff3da] pl-14 pr-6 text-lg font-semibold text-[#12213a] placeholder:font-semibold placeholder:text-[#366ab4] outline-none focus:border-[#255ba0]"
        />
      </div>

      {hasNoResult && (
        <Notice>검색 결과가 없습니다. 학교이름을 다시 확인해 주세요.</Notice>
      )}
      {searchStatus === "error" && (
        <Notice>연결이 불안정합니다. 다시 시도해 주세요.</Notice>
      )}
    </form>
  );
}

// 돋보기 아이콘 — 참고 이미지의 로열블루(#366ab4) 라인 돋보기. 입력필드 좌측에 겹쳐 배치.
function SearchIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      className="pointer-events-none absolute left-5 top-1/2 h-6 w-6 -translate-y-1/2"
      fill="none"
      stroke="#366ab4"
      strokeWidth="2.4"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="10.5" cy="10.5" r="6.5" />
      <line x1="15.5" y1="15.5" x2="21" y2="21" />
    </svg>
  );
}
