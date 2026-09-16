// 위치 이탈 경고 오버레이 — 내 위치가 행사장 bbox 밖일 때 전체화면 레드 톤으로 깜빡인다.
//   2D·3D 지도 공용. 시각 경고만(지도 위 fixed 오버레이) — 지도 조작은 계속 가능(pointer-events-none).
export function OutOfBoundsWarning() {
  return (
    <div className="pointer-events-none fixed inset-0 z-[75] flex items-center justify-center">
      {/* 가장자리로 갈수록 진해지는 레드 비네트(그라데이션) — 은은하게 깜빡임.
          중앙은 투명, 사방 가장자리만 붉게 → 지도 가림 없이 경고감. */}
      <div
        className="absolute inset-0 animate-[warn-blink_1s_ease-in-out_infinite]"
        style={{
          background:
            "radial-gradient(ellipse at center, rgba(255,138,42,0) 45%, rgba(249,110,32,0.4) 78%, rgba(230,74,20,0.8) 100%)",
        }}
      />

      {/* 중앙 경고 문구 */}
      <div className="relative flex flex-col items-center gap-3 px-6 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-full border-[3px] border-white bg-[#e23c3c] text-4xl shadow-[0_6px_16px_rgba(0,0,0,0.4)]">
          ⚠️
        </div>
        <p className="text-2xl font-extrabold text-white [text-shadow:0_2px_6px_rgba(0,0,0,0.6)]">
          위치를 벗어났습니다
        </p>
        <p className="text-sm font-semibold text-white/90 [text-shadow:0_1px_3px_rgba(0,0,0,0.6)]">
          구역 안으로 이동해 주세요.
        </p>
      </div>
    </div>
  );
}
