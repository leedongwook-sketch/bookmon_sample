"use client";

import { useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useGameStore } from "@/store/gameStore";
import { clearSavedGameState } from "@/lib/gameSession";
import { CollectionLayer } from "@/features/collection/CollectionLayer";

// 지도 위에서 열리는 오버레이 종류. 메뉴 항목이 늘면 여기에 추가.
type Overlay = "collection";

/**
 * 지도 페이지 공통 메뉴 — 왼쪽 위 햄버거.
 *  - 열면 메뉴 목록(현재: 몬스터 도감 / 초기화하기). MENU 배열에 항목을 추가하면 확장된다.
 *  - 몬스터 도감: 지도 위 레이어(도감 그리드). 지금은 화면만(데이터는 gameStore.collection 기반, 추후 채움).
 *  - 초기화하기: 확인 후 gameStore 초기화 + localStorage 삭제 + 루트로 이동.
 */
export function MapMenu() {
  const router = useRouter();
  const reset = useGameStore((s) => s.reset);

  const [open, setOpen] = useState(false); // 드롭다운 열림
  const [overlay, setOverlay] = useState<Overlay | null>(null);
  const [confirmReset, setConfirmReset] = useState(false);

  // ── 메뉴 항목(확장 지점) ─────────────────────────────
  const MENU: { key: string; label: string; run: () => void }[] = [
    {
      key: "collection",
      label: "몬스터 도감",
      run: () => setOverlay("collection"),
    },
    {
      key: "reset",
      label: "초기화하기",
      run: () => setConfirmReset(true),
    },
    // 추후 항목은 여기에 추가 (예: 도움말, 설정 …)
  ];

  const select = (run: () => void) => {
    setOpen(false);
    run();
  };

  const handleReset = () => {
    reset(); // 전역 상태 초기화
    clearSavedGameState(); // localStorage 삭제
    router.replace("/"); // 루트(진입 게이트)로
  };

  // 지도 드래그로 이벤트가 번지지 않도록 메뉴 UI는 pointerdown 전파를 막는다.
  const stop = (e: React.PointerEvent) => e.stopPropagation();

  return (
    <>
      {/* 햄버거 버튼 — 왼쪽 위 */}
      <button
        type="button"
        aria-label="메뉴"
        aria-expanded={open}
        onPointerDown={stop}
        onClick={() => setOpen((v) => !v)}
        className="absolute left-[max(0.75rem,var(--spacing-safe-l))] top-[max(0.75rem,var(--spacing-safe-t))] z-30 flex h-11 w-11 items-center justify-center rounded-xl border-2 border-navy bg-ivory/95 shadow-lg active:translate-y-[1px]"
      >
        <HamburgerIcon />
      </button>

      {/* 드롭다운 + 바깥 클릭 닫기 */}
      {open && (
        <>
          <div
            onPointerDown={stop}
            onClick={() => setOpen(false)}
            className="fixed inset-0 z-30"
          />
          <div
            onPointerDown={stop}
            className="absolute left-[max(0.75rem,var(--spacing-safe-l))] top-[calc(max(0.75rem,var(--spacing-safe-t))+3.25rem)] z-40 flex min-w-44 flex-col overflow-hidden rounded-xl border-2 border-navy bg-ivory shadow-xl"
          >
            {MENU.map((item) => (
              <button
                key={item.key}
                type="button"
                onClick={() => select(item.run)}
                className="px-5 py-3 text-left text-base font-bold text-navy transition-colors hover:bg-cream active:bg-cream"
              >
                {item.label}
              </button>
            ))}
          </div>
        </>
      )}

      {/* 몬스터 도감 오버레이 (모듈 재사용) */}
      {overlay === "collection" && (
        <CollectionLayer onClose={() => setOverlay(null)} />
      )}

      {/* 초기화 확인 */}
      {confirmReset && (
        <ConfirmDialog
          onConfirm={handleReset}
          onCancel={() => setConfirmReset(false)}
          onPointerDownCapture={stop}
        >
          현재 진행상황이 초기화됩니다.
          <br />
          처음으로 이동하시겠습니까?
        </ConfirmDialog>
      )}
    </>
  );
}

// 확인 다이얼로그 — 메시지 + 확인/취소.
function ConfirmDialog({
  children,
  onConfirm,
  onCancel,
  onPointerDownCapture,
}: {
  children: ReactNode;
  onConfirm: () => void;
  onCancel: () => void;
  onPointerDownCapture: (e: React.PointerEvent) => void;
}) {
  return (
    <div
      onPointerDown={onPointerDownCapture}
      onClick={onCancel}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="flex w-[min(88vw,360px)] flex-col items-center gap-6 rounded-[1.5rem] border-[5px] border-navy bg-gradient-to-b from-ivory to-cream px-6 py-7 shadow-2xl"
      >
        <p className="text-center text-base font-bold leading-relaxed text-navy">
          {children}
        </p>
        {/* 다이얼로그 전용 pill 버튼 — 취소=아웃라인 / 확인=골드 솔리드(깔끔·저채도). */}
        <div className="flex w-full gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 rounded-full border-2 border-navy/30 bg-white/70 py-2.5 text-base font-bold text-navy/70 transition-colors hover:bg-white active:bg-cream"
          >
            취소
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="flex-1 rounded-full border-2 border-[#d9a600] bg-gold py-2.5 text-base font-extrabold text-navy shadow-[0_2px_0_#d9a600] transition-transform active:translate-y-[1px] active:shadow-none"
          >
            확인
          </button>
        </div>
      </div>
    </div>
  );
}

function HamburgerIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="#12213a" strokeWidth="2.4" strokeLinecap="round">
      <line x1="4" y1="7" x2="20" y2="7" />
      <line x1="4" y1="12" x2="20" y2="12" />
      <line x1="4" y1="17" x2="20" y2="17" />
    </svg>
  );
}
