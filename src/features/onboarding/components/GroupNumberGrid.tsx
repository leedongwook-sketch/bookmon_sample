"use client";

import type { PlayGroup } from "@/types";

/**
 * 모둠 번호(1~20) 선택 그리드 — **2행 고정 + 가로 스크롤** (CSS 재현, 이미지 미사용).
 * Image #8/#9 실측:
 *  - 미선택(기본): 크림 면(#fff3da) + 파란 테두리(#366ab4) + 남색 숫자(#124889)
 *  - 선택: 파란 그라데이션 채움(#33b3f5→#3575bf) + 진파랑 테두리 + 흰색 숫자
 *
 * - 버튼에 min-h-0/min-w-0 → 전역 button 최소 48px 강제를 풀어 정사각형 유지(세로 눌림 방지).
 * - grid-flow-col + 2행 고정: 번호가 위→아래로 채워지며 열이 오른쪽으로 늘어난다(20모둠=2행×10열).
 * - 가로 스크롤 → 화면 폭을 넘는 열은 좌우로 스와이프. 세로는 2행 높이(96px)로 고정.
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
    // 2행(40px×2)+gap(6px)=86px < 본문 96px(여유 10px) → 스케일 반올림에도 잘리지 않음.
    //   no-scrollbar: 가로 스크롤바가 세로 공간을 먹지 않게(잘림 방지). flex items-center: 세로 가운데.
    <div className="no-scrollbar flex h-[96px] min-h-0 w-full items-center overflow-x-auto overflow-y-hidden">
      {/* mx-auto: 항목이 폭보다 좁으면 가로 가운데, 넘치면 margin=0 → 좌측부터 스크롤.
          (justify-center 는 overflow 시 좌측이 잘려 스크롤 불가 → margin:auto 로 회피.) */}
      <div className="mx-auto grid grid-flow-col grid-rows-2 gap-[6px]">
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
              // ⚠ 전역 button{min-height:48px}(globals.css, unlayered)이 Tailwind min-h-0(layered)를
              //   이겨 버튼이 48px 로 커진다(2행 잘림 원인). 인라인 minHeight/minWidth:0 은 모든 것을
              //   이기므로 여기서 강제해 h-[40px] 이 실제로 40px 가 되게 한다.
              style={{ minHeight: 0, minWidth: 0 }}
              /* 40 정사각, radius 8, border 3px, 기본 #FFF3DA/#366AB4, 선택 gradient #30BDFF→#366AB4 */
              className={`flex h-[40px] w-[40px] items-center justify-center rounded-[8px] border-[3px] border-[#366ab4] text-[15px] font-extrabold leading-none transition-all duration-100 active:translate-y-[1px] ${
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
    </div>
  );
}
