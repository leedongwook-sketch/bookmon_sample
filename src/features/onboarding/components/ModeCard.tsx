"use client";

import { useState } from "react";
import type { ModeOption } from "../modes";

// 모드 버튼 스타일(Frame 155~158 실측 재현, CSS).
//   idle: 크림 면(#fff3da) + 컬러 테두리/글자 + 하단 3D 림.
//   on(선택/클릭): 컬러 채움 + 흰 글자 + 살짝 내려앉으며 림 축소 (Frame 157/158).
// ⚠ Tailwind JIT가 감지하도록 각 모드 클래스를 **정적 문자열**로 둔다(동적 조합 금지).
const MODE_STYLE: Record<ModeOption["mode"], { idle: string; on: string }> = {
  // 실행모드 = 파랑(#3780ff) / 림 #174faf
  practice: {
    idle: "border-[#3780ff] bg-[#fff3da] text-[#3780ff] shadow-[0_6px_0_#174faf,0_8px_6px_rgba(0,0,0,0.45)] active:translate-y-[3px] active:bg-[#3780ff] active:text-white active:shadow-[0_3px_0_#174faf,0_4px_4px_rgba(0,0,0,0.42)]",
    on: "translate-y-[3px] border-[#3780ff] bg-[#3780ff] text-white shadow-[0_3px_0_#174faf,0_4px_4px_rgba(0,0,0,0.42)]",
  },
  // 행사모드 = 주황(#ff7d37) / 림 #933b00
  real: {
    idle: "border-[#ff7d37] bg-[#fff3da] text-[#ff7d37] shadow-[0_6px_0_#933b00,0_8px_6px_rgba(0,0,0,0.45)] active:translate-y-[3px] active:bg-[#ff7d37] active:text-white active:shadow-[0_3px_0_#933b00,0_4px_4px_rgba(0,0,0,0.42)]",
    on: "translate-y-[3px] border-[#ff7d37] bg-[#ff7d37] text-white shadow-[0_3px_0_#933b00,0_4px_4px_rgba(0,0,0,0.42)]",
  },
};

interface ModeCardProps {
  option: ModeOption;
  onSelect: (option: ModeOption) => void;
}

/**
 * 실행/행사 모드 버튼 — Frame 155~158 디자인을 CSS로 재현(간단한 도형이라 이미지 불필요).
 * 라벨은 텍스트로 렌더 → 문구 교체 자유.
 * 클릭 시 즉시 이동하면 선택 채움(Frame 157/158)이 안 보이므로, 채움 상태를 잠깐 보여준 뒤 진행한다.
 */
export function ModeCard({ option, onSelect }: ModeCardProps) {
  const [selected, setSelected] = useState(false);
  const style = MODE_STYLE[option.mode];

  const handleClick = () => {
    if (selected) return; // 중복 클릭 방지
    setSelected(true); // Frame 157/158 채움 상태 표시
    setTimeout(() => onSelect(option), 200); // 선택 피드백을 본 뒤 진행
  };

  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={handleClick}
      style={{ fontSize: "xx-large", fontWeight: "unset" }}
      className={`flex h-[75px] w-[205px] shrink-0 items-center justify-center rounded-[16px] border-[4px] transition-all duration-100 ${
        selected ? style.on : style.idle
      }`}
    >
      {option.label}
    </button>
  );
}
