"use client";

import { useState } from "react";
import { BootSplash } from "@/components/layout/BootSplash";
import { primeArPermissions } from "@/lib/device";

/**
 * 앱 맨 앞 권한 안내 게이트.
 * 로딩 화면(BootSplash) 위에 "모션·카메라 접근" 안내 알럿을 띄우고, [확인] 탭(사용자 제스처) 시
 * AR 권한을 최상위에서 1회 요청해두고 온보딩으로 넘어간다.
 * → 이후 AR(`/ar/shooting`) 진입 시 같은-origin 세션 권한을 물려받아 OS 권한창이 다시 안 뜬다.
 *
 * 주의: 이건 OS 권한창만 선처리한다. 8thwall 자체 시작/프롬프트 UI가 따로 보이면 그건 8thwall 설정.
 */
export function StartGate({ onReady }: { onReady: () => void }) {
  const [busy, setBusy] = useState(false);

  const handleConfirm = async () => {
    if (busy) return;
    setBusy(true);
    // [확인] 제스처 안에서 권한 요청 개시 → 허용/거부/미지원 무관하게 진행.
    await primeArPermissions();
    onReady();
  };

  return (
    <>
      {/* 원래 로딩 화면을 배경으로 */}
      <BootSplash />

      {/* 권한 안내 알럿 — 작고 부드럽게 */}
      <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/35 px-6 backdrop-blur-[2px]">
        <div
          role="alertdialog"
          aria-label="권한 안내"
          style={{ animation: "soft-pop 260ms ease-out" }}
          className="flex w-[min(78vw,280px)] flex-col items-center gap-2.5 rounded-3xl border border-navy/10 bg-ivory px-5 py-6 text-center shadow-[0_12px_32px_rgba(18,33,58,0.22)]"
        >
          <div className="flex h-11 w-11 items-center justify-center rounded-full bg-gold/90 text-xl">
            📷
          </div>
          <p className="text-[15px] font-bold leading-snug text-navy">
            북몬은 기기의 모션 및
            <br />
            카메라에 접근합니다
          </p>
          <p className="text-[12.5px] leading-relaxed text-navy/60">
            AR로 몬스터를 잡으려면 카메라와
            <br />
            동작·방향 센서가 필요해요.
          </p>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={busy}
            className="mt-2.5 flex h-10 w-full items-center justify-center rounded-full bg-gold text-[15px] font-bold text-navy shadow-[0_2px_8px_rgba(18,33,58,0.15)] transition active:translate-y-[1px] disabled:opacity-60"
          >
            {busy ? "준비 중…" : "확인"}
          </button>
        </div>
      </div>
    </>
  );
}
