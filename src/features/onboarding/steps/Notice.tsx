// 크림 패널 위 안내/예외 문구 (불러오는 중·검색 결과 없음·에러 등에 공용).
export function Notice({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-center text-sm font-semibold text-navy/80">{children}</p>
  );
}
