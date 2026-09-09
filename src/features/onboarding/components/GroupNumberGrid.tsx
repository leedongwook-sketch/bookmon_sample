"use client";

import type { PlayGroup } from "@/types";

/**
 * 모둠 번호(1~20) 선택 그리드 — 참고 이미지대로 10열 2행 (CSS 재현, 이미지 미사용).
 * Image #8/#9 실측:
 *  - 미선택(기본): 크림 면(#fff3da) + 파란 테두리(#366ab4) + 남색 숫자(#124889)
 *  - 선택: 파란 그라데이션 채움(#33b3f5→#3575bf) + 진파랑 테두리 + 흰색 숫자
 *
 * - 버튼에 min-h-0/min-w-0 → 전역 button 최소 48px 강제를 풀어 정사각형 유지(세로 눌림 방지).
 * - gap-2로 셀 사이 간격 확보(참고 이미지 간격 재현).
 */
export function GroupNumberGrid({
  groups,
  selectedKey,
  onSelect,
}: {
  groups: PlayGroup[];
  selectedKey?: string;
  onSelect: (group: PlayGroup) => void;
}) {
  return (
    <div className="flex w-full flex-wrap justify-center gap-[6px]">
      {groups.map((g) => {
        const selected = selectedKey === g.id;
        // 서버 이름("1모둠"/"1조")에서 **번호만** 표시. 접근성 라벨엔 전체 이름 유지.
        const label = g.name.match(/\d+/)?.[0] ?? g.name;
        return (
          <button
            key={g.id}
            type="button"
            aria-label={g.name}
            aria-pressed={selected}
            onClick={() => onSelect(g)}
            /* 피그마: 128.89→44 정사각, radius 26.48→9, border 8→3px, 기본 #FFF3DA/#366AB4, 선택 gradient #30BDFF→#366AB4 */
            className={`flex h-[44px] w-[44px] min-h-0 min-w-0 items-center justify-center rounded-[9px] border-[3px] border-[#366ab4] text-base font-extrabold leading-none transition-all duration-100 active:translate-y-[1px] ${
              selected
                ? "bg-gradient-to-b from-[#30bdff] to-[#366ab4] text-white"
                : "bg-[#fff3da] text-[#124889]"
            }`}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}
