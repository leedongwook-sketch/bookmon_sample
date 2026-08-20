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
 * 패널은 panel_basic 목업을 CSS/Tailwind로 재현한다(저해상 이미지 깨짐 방지, 세로 자유 확장).
 * 색상은 목업 실측값: 프레임/헤더 블루 #255ba0, 본문 크림 #fff7e5, 하단 림 딥네이비 #142745.
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
      {/* 뒤로 버튼: 좌상단 고정 코너, 안전영역 여백 반영.
          MapMenu 햄버거와 같은 코너 감각으로 FitToViewport 스케일과 무관하게 스캐폴드 루트에 배치.
          onBack이 있을 때만 노출 → 모드선택(BM-101)은 onBack 미전달로 자동 미표시.
          디자인: 다음 버튼(next_button.svg = CtaButton)과 톤 일치 —
          골드 그라데이션 #ffe797→#fec610→#ff8800 + 남색 테두리 #12213a + 갈색(#6b3400) 화살표. */}
      {onBack && (
        <button
          type="button"
          aria-label="뒤로"
          onClick={onBack}
          className="absolute left-[max(0.75rem,var(--spacing-safe-l))] top-[max(0.75rem,var(--spacing-safe-t))] z-30 flex h-10 w-10 items-center justify-center rounded-full border-2 border-[#12213a] bg-gradient-to-b from-[#ffe797] via-[#fec610] to-[#ff8800] shadow-[inset_0_2px_0_rgba(255,255,255,0.6),0_3px_0_#12213a,0_6px_10px_rgba(0,0,0,0.3)] active:translate-y-[2px] active:shadow-[inset_0_2px_0_rgba(255,255,255,0.45),0_1px_0_#12213a,0_3px_6px_rgba(0,0,0,0.25)]"
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

      {/* 콘텐츠를 뷰포트에 맞게 균일 축소 → 가로모드에서도 스크롤 없이 전부 보임 */}
      <FitToViewport className="z-10">
        {/* test.png 기준 비율: 로고 폭 ≈ 패널 폭의 0.62, 로고와 패널은 가깝게 */}
        <div className="flex w-[min(92vw,560px)] flex-col items-center gap-3">
          {/* 로고 (여백 크롭 후 종횡비 1914×1155 ≈ 1.66:1) */}
          <AssetImage
            src={ASSETS.logo}
            alt="BOOKMON 로고"
            width={1914}
            height={1155}
            className="h-auto w-[340px]"
          />

          {/* 패널 + 걸침 푸터 묶음 (footer가 패널 하단 모서리에 반쯤 걸침) */}
          <div className="relative flex w-full flex-col items-center">
            {/* 패널: 프레임 남색 그라데이션(상단 블루 #255ba0 → 하단 남색 #12213a) + 헤더 + 크림 본문.
                하단 남색 #12213a = 다음 버튼 테두리색과 동일 → 걸침 시 자연스럽게 이어짐. */}
            <div className="w-full rounded-[22px] border-2 border-[#12213a] bg-gradient-to-b from-[#255ba0] to-[#12213a] px-[6px] pb-[7px] shadow-[0_14px_28px_rgba(0,0,0,0.45)]">
              {/* 헤더바: 블루 프레임 상단, 흰 글씨 (화면별 동적 문구) */}
              <p className="px-6 py-2.5 text-center text-base font-extrabold text-white [text-shadow:0_1px_2px_rgba(0,0,0,0.35)]">
                {banner}
              </p>

              {/* 본문: 크림 면 + 안쪽 미세 보더 (footer 있으면 걸침 버튼 자리만큼 하단 여백 확보) */}
              <div
                className={`flex flex-col items-center gap-5 rounded-[16px] border border-[#eadcb4] bg-[#fff7e5] px-8 pt-6 shadow-[inset_0_1px_0_rgba(255,255,255,0.7)] ${
                  footer ? "pb-11" : "pb-6"
                }`}
              >
                {children}
              </div>
            </div>

            {/* 걸침 CTA: 패널 하단 중앙에 음수 마진으로 반쯤 걸침(in-flow → 축소 측정 정확) */}
            {footer && <div className="relative z-10 -mt-[23px]">{footer}</div>}
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
