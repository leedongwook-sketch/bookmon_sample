/**
 * 기기 판별 유틸.
 *
 * AR 체험은 카메라·자이로 센서가 필요해 스마트폰에서만 동작한다.
 * PC(데스크톱/노트북)에서는 AR 요청을 막기 위해 "모바일 여부"를 판정한다.
 */

interface NavigatorUAData {
  mobile?: boolean;
}

/**
 * 현재 기기가 모바일(스마트폰류)인지 추정한다.
 *  1) Chromium `navigator.userAgentData.mobile` — 명시적 모바일 플래그(가장 신뢰).
 *  2) UserAgent 정규식 폴백 — Android/iPhone 등.
 *  3) iPadOS 13+는 데스크톱 Safari(Macintosh)로 위장 → 터치 지원으로 보정.
 *
 * SSR(navigator 없음)에서는 false를 반환하므로, 반드시 클라이언트 이벤트 시점에 호출한다.
 */
export function isMobileDevice(): boolean {
  if (typeof navigator === "undefined") return false;

  const uaData = (navigator as Navigator & { userAgentData?: NavigatorUAData })
    .userAgentData;
  if (uaData && typeof uaData.mobile === "boolean") return uaData.mobile;

  const ua = navigator.userAgent;
  if (/Android|iPhone|iPod|iPad|Windows Phone|BlackBerry|Opera Mini|IEMobile|Mobile/i.test(ua)) {
    return true;
  }

  // iPadOS 13+ 위장 케이스(Macintosh인데 멀티터치) 보정.
  return /Macintosh/.test(ua) && navigator.maxTouchPoints > 1;
}
