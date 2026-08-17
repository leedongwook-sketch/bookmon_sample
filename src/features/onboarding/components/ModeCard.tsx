import { ASSETS } from "@/constants/assets";
import type { ModeOption } from "../modes";

// 목업 버튼 SVG(라벨 baked). 체험=스카이블루 / 행사=골드. viewBox 199×80.
const MODE_IMAGE: Record<ModeOption["mode"], string> = {
  practice: ASSETS.btnModePractice,
  real: ASSETS.btnModeEvent,
};

interface ModeCardProps {
  option: ModeOption;
  onSelect: (option: ModeOption) => void;
}

/**
 * 실행모드 버튼 — 목업 SVG를 그대로 사용(라벨이 벡터에 포함, 확대해도 안 깨짐).
 * 두 버튼 크기를 원본 비율(199×80 ≈ 2.49:1)로 고정해 항상 일치. active:translate로 눌림 피드백.
 * 접근성: 이미지 버튼이므로 aria-label로 스크린리더용 텍스트를 제공한다.
 * (SVG라 next/image 대신 plain img — 벡터를 그대로 서빙해 최상 선명도)
 */
export function ModeCard({ option, onSelect }: ModeCardProps) {
  return (
    <button
      type="button"
      aria-label={option.label}
      onClick={() => onSelect(option)}
      className="block h-[76px] w-[189px] transition-transform duration-100 active:translate-y-[2px] sm:h-[88px] sm:w-[219px]"
    >
      {/* eslint-disable-next-line @next/next/no-img-element -- 벡터(SVG) 버튼: next/image 최적화 불필요 */}
      <img
        src={MODE_IMAGE[option.mode]}
        alt=""
        aria-hidden="true"
        className="h-full w-full object-contain"
        draggable={false}
      />
    </button>
  );
}
