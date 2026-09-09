import type { ReactNode } from "react";
import { FitToViewport } from "@/components/layout/FitToViewport";
import { AssetImage } from "@/components/ui/AssetImage";
import { ASSETS } from "@/constants/assets";

interface OnboardingScaffoldProps {
  banner: string; // 패널 상단 헤더바 안내 문구 (화면별 동적)
  children: ReactNode; // 패널 본문 (버튼/입력 등 화면별 요소)
  footer?: ReactNode; // 패널 하단 모서리 중앙에 걸치는 CTA(예: "다음") — 없으면 미표시
  onBack?: () => void; // 있으면 좌상단 뒤로 버튼 렌더 → 이전 단계로. 없으면 미표시(예: 모드선택 BM-101)
  backgroundUrl?: string; // 온보딩 배경(랜덤). 상위(OnboardingFlow)가 진입 시 1회 골라 전달.
}

/**
 * 온보딩 화면 공통 골격 (BM-101/102/... 공유).
 * 블러 배경 + 로고 + 패널(헤더 문구 + children).
 *
 * 패널은 참고 이미지(onboarding_ex)를 실측해 CSS/Tailwind로 재현한다.
 * 실측색: 로열블루 프레임/헤더 #366ab4, 본문 = 흰→연회색 세로 그라데이션(#fdfdfd→#e8e8e8).
 * 구조: 로열블루 라운드 프레임(드롭섀도) → 흰 글씨 헤더 → 연회색 inset 라운드 패널(children).
 * 화면마다 다른 부분(모드 버튼 / 학교 입력 등)만 children으로 갈아끼운다.
 */
export function OnboardingScaffold({
  banner,
  children,
  footer,
  onBack,
  backgroundUrl,
}: OnboardingScaffoldProps) {
  return (
    <div
      className={[
        "relative h-[100dvh] w-full overflow-hidden bg-[#241a12]",
        // 안전영역(노치/홈바) 여백 — 이 안쪽 영역에 콘텐츠를 맞춘다
        "px-[max(0.75rem,var(--spacing-safe-l))] py-[max(0.75rem,var(--spacing-safe-t))]",
        "pr-[max(0.75rem,var(--spacing-safe-r))] pb-[max(0.75rem,var(--spacing-safe-b))]",
      ].join(" ")}
    >
      {/* 뒤로 버튼: 좌상단 고정 코너, 안전영역 여백 반영. onBack 있을 때만 노출.
          디자인 = 기본 버튼(CtaButton)과 동일: 골드 면 + 135.81° 광택 테두리 + 갈색 하단 림.
          눌림 시 주황 전환. 코너 아이콘 버튼이라 원형(rounded-full)으로만 축소 적용. */}
      {onBack && (
        <button
          type="button"
          aria-label="뒤로"
          onClick={onBack}
          className={[
            "absolute left-[max(0.75rem,var(--spacing-safe-l))] top-[max(0.75rem,var(--spacing-safe-t))] z-30",
            "flex h-12 w-12 items-center justify-center rounded-full",
            "border-[4px] border-transparent",
            "[background:linear-gradient(180deg,#fec610,#e9a300)_padding-box,linear-gradient(135.81deg,#ffe16a_17.76%,#eb8005_82.83%)_border-box]",
            "shadow-[0_5px_0_#7c3e00,0_4px_7px_rgba(0,0,0,0.5)]",
            "transition-all duration-100",
            "active:translate-y-[3px] active:[background:linear-gradient(180deg,#ff9028,#e95900)_padding-box,linear-gradient(135.81deg,#ffaa6a_17.76%,#eb5d05_82.83%)_border-box]",
            "active:shadow-[0_2px_0_#7c3e00,0_2px_5px_rgba(0,0,0,0.5)]",
          ].join(" ")}
        >
          <BackArrowIcon />
        </button>
      )}

      {/* 배경: 온보딩 배경(랜덤 선택본) + 가독성용 어두운 오버레이 */}
      {backgroundUrl && (
        <div
          className="fixed inset-0 z-0"
          style={{
            backgroundImage: `url(${backgroundUrl})`,
            backgroundSize: "100% 100%",
            backgroundPosition: "center",
            backgroundRepeat: "no-repeat",
          }}
        >
          <div className="absolute inset-0 bg-black/30" />
        </div>
      )}

      {/* 콘텐츠를 뷰포트에 맞게 균일 축소 → 가로모드에서도 스크롤 없이 전부 보임(확대 없이 축소만) */}
      <FitToViewport className="z-10">
        {/* 그림자 여백 래퍼: FitToViewport 는 offsetHeight(그림자 제외)로 배율을 잡아
            딱 맞게 축소하면 패널 드롭섀도/하단 립이 overflow-hidden 에 잘린다.
            이 패딩만큼 측정 박스를 키워 그림자가 잘리지 않게 한다(패널 폭은 아래 그대로 유지). */}
        <div className="px-8 pb-12 pt-2">
        {/* 고정 px 구조(560) → FitToViewport가 화면에 맞춰 균일 스케일. 비율은 모든 화면에서 동일. */}
        <div className="flex w-[560px] flex-col items-center gap-3">
          {/* 로고 (새 BOOKMON 로고, 트림 후 종횡비 1280×814 ≈ 1.57:1) */}
          <AssetImage
            src={ASSETS.logo}
            alt="BOOKMON 로고"
            width={1280}
            height={814}
            className="h-auto w-[340px]"
          />

          {/* 패널 + 걸침 푸터 묶음 (footer가 패널 하단 모서리에 반쯤 걸침) */}
          <div className="relative flex w-full flex-col items-center">
            {/* 기본 패널 — 피그마(스케일 0.332) 3레이어:
                프레임(#366AB4, radius 56.74→19, pad 37.82/26.48→13/9, gap 12.63→4)
                + 네이비 베이스(#124889, 아래 offset → box-shadow 0 7px 0) + 드롭섀도(-10 10 20 #00000080→스케일). */}
            <div className="flex w-full flex-col gap-[4px] rounded-[19px] bg-[#366ab4] px-[9px] pt-[13px] pb-[9px] shadow-[0_7px_0_#124889,-3px_6px_8px_rgba(0,0,0,0.5)]">
              {/* 헤더바: 프레임 위 흰색 볼드 중앙정렬 (화면별 동적 문구). */}
              <p className="px-6 text-center text-base font-extrabold text-white [text-shadow:0_1px_2px_rgba(0,0,0,0.28)]">
                {banner}
              </p>

              {/* 내부 패널(layout2) — radius 45.39→15, pad 56.74/113.47→19/38(하단 2배), 흰→#E1E1E1 그라데. */}
              <div className="flex w-full flex-col items-center gap-[5px] rounded-[15px] bg-gradient-to-b from-[#ffffff] to-[#e1e1e1] px-[19px] pt-[19px] pb-[38px] shadow-[inset_0_1px_0_rgba(255,255,255,0.9),0_1px_2px_rgba(0,0,0,0.08)]">
                {children}
              </div>
            </div>

            {/* 걸침 CTA: 패널 하단 중앙에 음수 마진으로 반쯤 걸침(in-flow → 축소 측정 정확) */}
            {footer && <div className="relative z-10 -mt-[26px]">{footer}</div>}
          </div>
        </div>
        </div>
      </FitToViewport>
    </div>
  );
}

// 뒤로 화살표(←) — 라인 SVG. 색은 다음 버튼 라벨과 동일한 갈색(#6b3400)으로 톤 일치.
function BackArrowIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="#6b3400" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
      <line x1="19" y1="12" x2="6" y2="12" />
      <polyline points="12,6 6,12 12,18" />
    </svg>
  );
}
