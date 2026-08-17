"use client";

import { ASSETS } from "@/constants/assets";
import type { PlayGroup } from "@/types";

// group_num_*.svg 스프라이트 지오메트리(실측). 10×2 = 20칸.
const CELL = 35.1281; // 셀 한 변(px)
const PITCH = 40.9082; // 셀 간격(셀+거터)
const ORIGIN = 0.525888; // 첫 셀 좌상단 오프셋
const SVG_W = 405;
const SVG_H = 78;
const COLS = 10;

// 추출 창을 셀보다 여백(MARGIN)만큼 키워 셀 상/하단이 빡빡하게 잘리지 않게 한다.
// (거터 ≈ 2.9px/변. 그보다 작게 잡아 옆 칸이 안 비치도록.)
const MARGIN = 2.2;
const WIN = CELL + MARGIN * 2; // 실제로 보여줄 창 한 변

// 창을 컨테이너(=1칸)에 맞춰 확대하는 배율.
const BG_SIZE = `${(SVG_W / WIN) * 100}% ${(SVG_H / WIN) * 100}%`;

// 칸 인덱스(0~19) → background-position(%). 창 좌상단 = 셀 좌상단 − MARGIN.
function cellPosition(index: number): string {
  const col = index % COLS;
  const row = Math.floor(index / COLS);
  const left = ORIGIN + col * PITCH - MARGIN;
  const top = ORIGIN + row * PITCH - MARGIN;
  const x = (left / (SVG_W - WIN)) * 100;
  const y = (top / (SVG_H - WIN)) * 100;
  return `${x}% ${y}%`;
}

/**
 * 모둠 번호(1~20) 선택 그리드 — group_num_noselect/select.svg 스프라이트를 칸별로 잘라 버튼화.
 * 선택 시 배경 스프라이트만 교체(미선택=크림 / 선택=스카이블루). 숫자는 SVG에 baked.
 *
 * - 버튼에 min-h-0/min-w-0 → 전역 button 최소 48px 강제를 풀어 정사각형 유지(세로 눌림 방지).
 * - 추출 창에 MARGIN 여백 포함 → 셀 상/하단이 잘리지 않고 여유 있게 보인다.
 * - gap-2로 셀 사이 간격 확보.
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
    <div className="grid grid-cols-10 gap-2">
      {groups.map((g, i) => {
        const num = parseInt(g.name, 10);
        const cellIndex = num >= 1 && num <= 20 ? num - 1 : i;
        const selected = selectedKey === g.id;
        return (
          <button
            key={g.id}
            type="button"
            aria-label={g.name}
            aria-pressed={selected}
            onClick={() => onSelect(g)}
            style={{
              aspectRatio: "1 / 1",
              backgroundImage: `url(${
                selected ? ASSETS.groupNumSelected : ASSETS.groupNumIdle
              })`,
              backgroundSize: BG_SIZE,
              backgroundPosition: cellPosition(cellIndex),
              backgroundRepeat: "no-repeat",
            }}
            className="min-h-0 min-w-0 w-full transition-transform duration-100 active:translate-y-[1px]"
          />
        );
      })}
    </div>
  );
}
