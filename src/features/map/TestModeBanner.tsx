// ⚠ 테스트 전용 — 실 프로세스에서는 GPS 도착 판정으로 조우가 트리거된다.
//   이 파일과 2D/3D의 <TestModeBanner /> 사용처만 지우면 제거됨(코어 무영향).

/**
 * 지도 상단 중앙에 뜨는 임시 테스트 안내 배너 (2D·3D 공용).
 */
export function TestModeBanner() {
  return (
    <div className="pointer-events-none absolute left-1/2 top-[max(0.75rem,var(--spacing-safe-t))] z-20 -translate-x-1/2">
      <div className="whitespace-nowrap rounded-full border-2 border-navy bg-gold/95 px-4 py-1.5 text-center text-xs font-extrabold text-navy shadow-lg">
        테스트모드 · 몬스터 마커 클릭 시 이벤트 발생
      </div>
    </div>
  );
}
