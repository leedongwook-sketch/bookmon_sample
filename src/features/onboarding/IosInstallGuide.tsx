"use client";

import { useEffect, useState } from "react";
import { isIOS, isStandalone } from "@/lib/device";

// iOS 홈 화면 추가 안내 — iOS 는 전체화면·가로잠금 API 가 없어, 설치(홈 화면 추가) 시에만 완전 가로
//   전체화면이 된다. 그래서 방법을 안내한다. (Android 는 전체화면+orientation.lock 으로 이미 되므로
//   설치 안내 불필요.) iOS + 미설치(standalone 아님)일 때만 1회 노출(닫으면 기억).
const DISMISS_KEY = "bookmon-ios-guide-dismissed";

export function IosInstallGuide() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (!isIOS() || isStandalone()) return; // iOS 미설치일 때만
    let dismissed = false;
    try {
      dismissed = localStorage.getItem(DISMISS_KEY) === "1";
    } catch {
      dismissed = false;
    }
    if (!dismissed) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setShow(true);
    }
  }, []);

  if (!show) return null;

  const close = () => {
    try {
      localStorage.setItem(DISMISS_KEY, "1");
    } catch {
      /* 무시 */
    }
    setShow(false);
  };

  return (
    <div className="fixed inset-0 z-[1300] flex items-end justify-center bg-black/55 p-4">
      <div className="animate-[soft-pop_260ms_ease-out] mb-2 w-[min(92vw,400px)] rounded-[20px] border-2 border-navy bg-ivory px-5 py-5 text-center shadow-[0_14px_30px_rgba(0,0,0,0.45)]">
        <p className="text-lg font-extrabold text-navy">
          전체화면으로 즐기려면
        </p>
        <p className="mt-1 text-sm leading-relaxed text-navy/80">
          하단 <ShareIcon /> <b>공유</b> 버튼을 누르고
          <br />
          <b>&lsquo;홈 화면에 추가&rsquo;</b>를 선택해 주세요.
        </p>
        {/* 하단 공유 버튼을 가리키는 화살표(아이폰 Safari 공유는 화면 하단) */}
        <div className="mt-3 flex items-center justify-center gap-2 text-[#2f6fd0]">
          <ShareIcon />
          <span className="text-xl">↓</span>
        </div>
        <button
          type="button"
          onClick={close}
          className="mt-4 flex h-11 w-full items-center justify-center rounded-full border-2 border-navy/30 bg-white/80 text-base font-bold text-navy/70 active:bg-cream"
        >
          나중에 하기
        </button>
      </div>
    </div>
  );
}

// iOS 공유 아이콘(네모+위 화살표) — 라인 SVG.
function ShareIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="inline-block h-5 w-5 align-text-bottom"
      fill="none"
      stroke="#2f6fd0"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M12 3 L12 15" />
      <path d="M8 7 L12 3 L16 7" />
      <path d="M6 12 L6 20 A1 1 0 0 0 7 21 L17 21 A1 1 0 0 0 18 20 L18 12" />
    </svg>
  );
}
