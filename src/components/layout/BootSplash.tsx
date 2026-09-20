import { ScreenContainer } from "./ScreenContainer";

/**
 * 진입 게이트가 localStorage를 검사하는 동안 잠깐 보여주는 스플래시.
 * 모드선택 화면이 깜빡였다가 /map으로 튕기는 것을 방지한다.
 */
export function BootSplash() {
  return (
    <ScreenContainer className="bg-[#241a12] text-cream">
      <div className="flex flex-col items-center gap-3">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-cream/30 border-t-cream" />
        <p className="text-sm font-semibold opacity-80">불러오는 중…</p>
      </div>
    </ScreenContainer>
  );
}
