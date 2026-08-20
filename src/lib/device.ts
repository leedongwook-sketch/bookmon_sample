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

interface PermissionRequestable {
  requestPermission?: () => Promise<PermissionState | string>;
}

/**
 * AR 권한(카메라·모션/방향)을 앱 맨 앞(최상위)에서 **1회** 미리 허용한다.
 *
 * C안에서 AR은 최상위 문서(`/ar/shooting`, 같은 origin)로 실행되므로, 여기서 최상위에서
 * 권한을 확보해두면 이후 AR 진입 시 같은-origin 세션 권한을 물려받아 **OS 권한창이 재요청되지 않는다.**
 * (iframe 시절과 달리 서브프레임 상속 문제가 없다.)
 *
 * ⚠️ 반드시 **사용자 제스처(탭/클릭) 안**에서 호출. iOS 모션은 `click` 제스처 + 동기 개시가 필수라
 *    getUserMedia/requestPermission 를 모두 await 없이 동기적으로 시작한다.
 * ⚠️ **보안 컨텍스트(HTTPS/localhost)** 필요. PC(비모바일)는 AR 차단이라 프라이밍하지 않는다.
 * 거부/미지원은 조용히 넘어간다.
 *
 * 참고: 이건 **OS 권한창**만 선처리한다. 8thwall 자체 랜딩/시작 UI는 8thwall 쪽 설정 사항.
 */
export async function primeArPermissions(): Promise<void> {
  if (typeof window === "undefined") return;
  if (!isMobileDevice()) return; // PC는 AR 차단 → 불필요

  const dme = DeviceMotionEvent as unknown as PermissionRequestable;
  const doe = DeviceOrientationEvent as unknown as PermissionRequestable;

  // 제스처 유지: 세 요청을 모두 await 없이 동기 개시한 뒤 한꺼번에 대기.
  const motionP =
    typeof dme.requestPermission === "function"
      ? dme.requestPermission().catch(() => {})
      : Promise.resolve();
  const orientP =
    typeof doe.requestPermission === "function"
      ? doe.requestPermission().catch(() => {})
      : Promise.resolve();
  const cameraP = navigator.mediaDevices?.getUserMedia
    ? navigator.mediaDevices
        .getUserMedia({ video: { facingMode: "environment" } })
        .then((stream) => stream.getTracks().forEach((t) => t.stop()))
        .catch(() => {})
    : Promise.resolve();

  await Promise.allSettled([motionP, orientP, cameraP]);
}
