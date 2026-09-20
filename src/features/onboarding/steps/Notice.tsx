// 크림 패널 위 안내/예외 문구 (불러오는 중·검색 결과 없음·에러 등에 공용).
export function Notice({ children }: { children: React.ReactNode }) {
  return (
    // shrink-0: 고정 높이 패널에서 스크롤 영역과 함께 놓일 때 문구가 눌리지 않게 한다.
    <p className="shrink-0 text-center text-sm font-semibold text-navy/80">
      {children}
    </p>
  );
}
