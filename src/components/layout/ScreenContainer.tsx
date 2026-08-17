import type { ReactNode } from "react";

interface ScreenContainerProps {
  children: ReactNode;
  className?: string;
}

/**
 * 모든 화면의 공통 컨테이너.
 * - 뷰포트 전체를 채우되(100dvh) 안전영역(노치/홈바) 여백 확보
 * - 콘텐츠가 뷰포트보다 커지면 잘리지 않고 세로 스크롤(반응형 안전장치)
 * - 내부 래퍼에 m-auto → 여유 있으면 중앙정렬, 넘치면 위에서부터 스크롤(상단 안 잘림)
 * - 가로/세로 어느 방향에서도 왜곡·클리핑 없이 렌더
 */
export function ScreenContainer({ children, className }: ScreenContainerProps) {
  return (
    <div
      className={[
        "relative flex min-h-[100dvh] w-full flex-col items-center",
        "overflow-x-hidden overflow-y-auto",
        "px-[max(0.75rem,var(--spacing-safe-l))] py-[max(0.75rem,var(--spacing-safe-t))]",
        "pr-[max(0.75rem,var(--spacing-safe-r))] pb-[max(0.75rem,var(--spacing-safe-b))]",
        className ?? "",
      ].join(" ")}
    >
      <div className="m-auto flex w-full max-w-full flex-col items-center">
        {children}
      </div>
    </div>
  );
}
