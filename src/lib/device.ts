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

// 세션당 1회만 프라이밍(같은 탭 내 재요청 방지). 세션 종료 후 재진입 시 다시 1회.
const AR_PERMISSION_PRIMED_KEY = "bookmon-ar-perm-primed";

interface PermissionRequestable {
  requestPermission?: () => Promise<PermissionState | string>;
}

/**
 * AR 권한(카메라·모션/방향)을 앱 진입 시 **한 번만** origin 레벨로 미리 허용한다.
 *
 * 배경: AR은 매번 새 iframe(8thwall)에서 카메라·모션을 요청 → 진입할 때마다 허용창이 뜬다.
 * 여기서 최상위 문서(같은 origin)에서 먼저 권한을 확보해두면, 이후 같은-origin AR iframe이
 * 그 권한을 물려받아 다시 묻지 않는다.
 *
 * 반드시 **사용자 제스처(클릭/터치) 핸들러 안**에서 호출해야 한다(권한 API 요건).
 * PC(비모바일)에서는 AR을 막으므로 프라이밍하지 않는다(불필요한 카메라 창 방지).
 * 거부/미지원은 조용히 넘어간다 — 실제 AR 진입 시 다시 안내된다.
 */
export async function primeArPermissions(): Promise<void> {
  if (typeof window === "undefined") return;
  if (!isMobileDevice()) return; // PC는 AR 차단 → 프라이밍 불필요
  if (sessionStorage.getItem(AR_PERMISSION_PRIMED_KEY)) return; // 세션 내 1회
  sessionStorage.setItem(AR_PERMISSION_PRIMED_KEY, "1"); // 재진입 중복 호출 방지(먼저 마킹)

  // 카메라: 후면 카메라 스트림을 잠깐 열어 origin 권한을 확보한 뒤 즉시 정리.
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: "environment" },
    });
    stream.getTracks().forEach((t) => t.stop());
  } catch {
    // 거부/미지원 — AR 진입 시 8thwall이 다시 요청.
  }

  // 모션·방향(iOS 13+ Safari만 requestPermission 존재). 나머지 브라우저는 권한창 없음.
  const dme = DeviceMotionEvent as unknown as PermissionRequestable;
  const doe = DeviceOrientationEvent as unknown as PermissionRequestable;
  try {
    if (typeof dme.requestPermission === "function") await dme.requestPermission();
  } catch {
    /* 무시 */
  }
  try {
    if (typeof doe.requestPermission === "function") await doe.requestPermission();
  } catch {
    /* 무시 */
  }
}
