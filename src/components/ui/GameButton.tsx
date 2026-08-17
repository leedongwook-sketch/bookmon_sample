import type { ButtonHTMLAttributes } from "react";

// 톤앤매너: 체험/주액션=스카이블루, 행사/확정=골드, 선택 카드=크림, 보조=주황.
type Variant = "primary" | "gold" | "cream" | "orange";

const VARIANT_CLASS: Record<Variant, string> = {
  // 스카이블루 (주 버튼 / 체험모드) — 흰 글씨, 진한 파랑 보더 (onboard_button2)
  primary:
    "text-white [text-shadow:0_1px_2px_rgba(0,0,0,0.3)] border-[#1461a8] bg-gradient-to-b from-[#5cc4ff] via-[#22a7f6] to-[#0d8fe6] shadow-[inset_0_2px_0_rgba(255,255,255,0.55),0_5px_0_#0a6cb5,0_9px_14px_rgba(0,0,0,0.35)] active:shadow-[inset_0_2px_0_rgba(255,255,255,0.4),0_2px_0_#0a6cb5,0_5px_9px_rgba(0,0,0,0.3)]",
  // 골드 (강조·확정 / 행사모드) — 흰 글씨 + 네이비 보더 (button_basic / onboard_button)
  gold: "text-white [text-shadow:0_1px_2px_rgba(0,0,0,0.45)] border-navy bg-gradient-to-b from-[#ffdc5c] via-[#febe1a] to-[#f9a800] shadow-[inset_0_2px_0_rgba(255,255,255,0.65),0_5px_0_#d98f00,0_9px_14px_rgba(0,0,0,0.35)] active:shadow-[inset_0_2px_0_rgba(255,255,255,0.5),0_2px_0_#d98f00,0_5px_9px_rgba(0,0,0,0.3)]",
  // 크림/아이보리 카드 (선택 목록 등) — 네이비 글씨
  cream:
    "text-navy border-[#12213a] bg-gradient-to-b from-[#fff6e1] to-[#f7e9c6] shadow-[inset_0_2px_0_rgba(255,255,255,0.8),0_5px_0_#c9b78a,0_9px_14px_rgba(0,0,0,0.3)] active:shadow-[inset_0_2px_0_rgba(255,255,255,0.6),0_2px_0_#c9b78a,0_5px_9px_rgba(0,0,0,0.3)]",
  // 주황 통배경 (보조 액션 / 뒤로) — 흰 글씨
  orange:
    "text-white [text-shadow:0_1px_2px_rgba(0,0,0,0.35)] border-[#c96a12] bg-gradient-to-b from-[#ff9f3a] to-[#f5871f] shadow-[inset_0_2px_0_rgba(255,255,255,0.5),0_5px_0_#b3600f,0_9px_14px_rgba(0,0,0,0.35)] active:shadow-[inset_0_2px_0_rgba(255,255,255,0.4),0_2px_0_#b3600f,0_5px_9px_rgba(0,0,0,0.3)]",
};

interface GameButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  selected?: boolean; // 단일 선택 강조 (골드 링)
}

/**
 * 게임풍 둥근 입체 버튼 — 색면 그라데이션 + 아래쪽 두께감 + 상단 광택 + 눌림.
 * 모든 버튼의 공통 기반. 톤앤매너 색 역할만 variant로 구분.
 */
export function GameButton({
  variant = "primary",
  selected = false,
  className = "",
  children,
  ...props
}: GameButtonProps) {
  const selectedClass = selected
    ? " ring-4 ring-gold ring-offset-2 ring-offset-[#f7e9c6]"
    : "";
  return (
    <button
      type="button"
      {...props}
      className={`relative rounded-2xl border-[3px] font-extrabold transition-all duration-100 active:translate-y-[3px] disabled:translate-y-0 disabled:opacity-50 ${VARIANT_CLASS[variant]}${selectedClass} ${className}`}
    >
      {children}
    </button>
  );
}
