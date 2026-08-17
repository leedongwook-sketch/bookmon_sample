"use client";

import { useEffect, useState } from "react";

// self-hosted 8thwall 번들 위치 (public/ar/). 실제 번들로 교체 예정.
const AR_BUNDLE_URL = "/ar/index.html";
// iframe → 부모 메시지 네임스페이스 (잡음 메시지 필터)
const AR_MESSAGE_SOURCE = "bookmon-ar";

export interface ArSessionParams {
  imageUrl: string; // 몬스터 이미지 경로
  hitCount: number; // 타격 횟수
  onSuccess?: (payload: unknown) => void; // 포획 성공
  onFail?: () => void; // 실패
}

/**
 * AR 조우 오버레이 — self-hosted 번들을 iframe으로 온디맨드 로드.
 *  - 입력(imageUrl, hitCount)은 쿼리스트링으로 전달.
 *  - 결과(success/fail/close)는 iframe → 부모 postMessage로 수신.
 *  - 언마운트되면 iframe이 제거되어 카메라·엔진이 완전히 해제된다(배터리/리소스).
 */
export function ArOverlay({
  imageUrl,
  hitCount,
  onSuccess,
  onFail,
  onClose,
}: ArSessionParams & { onClose: () => void }) {
  const [visible, setVisible] = useState(false); // 페이드인

  useEffect(() => {
    const id = requestAnimationFrame(() => setVisible(true));
    return () => cancelAnimationFrame(id);
  }, []);

  useEffect(() => {
    const handle = (e: MessageEvent) => {
      if (e.origin !== window.location.origin) return; // self-host = same-origin
      const data = e.data as { source?: string; type?: string; payload?: unknown };
      if (!data || data.source !== AR_MESSAGE_SOURCE) return;
      if (data.type === "success") {
        // 성공 → AR을 페이드아웃(지도가 뒤에서 드러남)한 뒤 onSuccess 호출.
        //   부모가 이 콜백에서 iframe을 닫고(지도로 전환) 도감을 띄운다.
        const payload = data.payload;
        setVisible(false); // opacity → 0 (200ms transition)
        window.setTimeout(() => onSuccess?.(payload), 220);
      } else if (data.type === "fail") {
        onFail?.();
        onClose();
      } else if (data.type === "close") {
        onClose();
      }
    };
    window.addEventListener("message", handle);
    return () => window.removeEventListener("message", handle);
  }, [onSuccess, onFail, onClose]);

  // image가 비면 파라미터를 생략 → 8thwall 번들이 내장 스프라이트(bookmon1.png)로 폴백한다.
  //   (테스트: 몬스터 이미지 경로 없음 → 내장 사용 / 실서비스: 실 경로 넘기면 그대로 사용)
  const params = new URLSearchParams();
  if (imageUrl) params.set("image", imageUrl);
  params.set("hits", String(hitCount));
  const src = `${AR_BUNDLE_URL}?${params.toString()}`;

  return (
    <div
      onPointerDown={(e) => e.stopPropagation()}
      className={`fixed inset-0 z-[60] bg-black transition-opacity duration-200 ${
        visible ? "opacity-100" : "opacity-0"
      }`}
    >
      <iframe
        src={src}
        title="AR"
        className="h-full w-full border-0"
        allow="camera; microphone; gyroscope; accelerometer; magnetometer; xr-spatial-tracking; fullscreen"
      />
      {/* 닫기(안전장치). 번들이 자체 종료 UI를 제공하면 제거 가능. */}
      <button
        type="button"
        aria-label="AR 닫기"
        onClick={onClose}
        className="absolute right-[max(0.75rem,var(--spacing-safe-r))] top-[max(0.75rem,var(--spacing-safe-t))] flex h-10 w-10 items-center justify-center rounded-full border-2 border-navy bg-ivory/95 text-navy shadow-lg"
      >
        ✕
      </button>
    </div>
  );
}
