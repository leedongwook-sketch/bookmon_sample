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
 *
 * ⚠️ 판정은 **양성 신호 OR** 방식 — 하나라도 모바일이라고 하면 모바일로 본다.
 *    (`userAgentData.mobile`을 조기 return 으로 신뢰하면, 일부 안드로이드 인앱
 *     브라우저/웹뷰가 이 값을 false 로 줄 때 UA에 `Android`가 있어도 PC로 오판한다.)
 *
 *  1) UserAgent 정규식 — Android/iPhone 등 **명시적 모바일 OS**(가장 확실한 양성 신호).
 *  2) Chromium `navigator.userAgentData.mobile === true` — 보조 양성 신호.
 *  3) iPadOS 13+는 데스크톱 Safari(Macintosh)로 위장 → 멀티터치로 보정.
 *  4) 그 외 터치 지원 기기 폴백(coarse pointer + 터치포인트).
 *
 * SSR(navigator 없음)에서는 false를 반환하므로, 반드시 클라이언트 이벤트 시점에 호출한다.
 */
export function isMobileDevice(): boolean {
  if (typeof navigator === "undefined") return false;

  const ua = navigator.userAgent || "";

  // 1) 명시적 모바일 OS — UA에 Android/iPhone 등이 있으면 무조건 모바일.
  if (/Android|iPhone|iPod|iPad|Windows Phone|BlackBerry|Opera Mini|IEMobile|Mobile/i.test(ua)) {
    return true;
  }

  // 2) Chromium client hints — mobile === true 인 경우만 양성으로 취급(false 는 무시).
  const uaData = (navigator as Navigator & { userAgentData?: NavigatorUAData })
    .userAgentData;
  if (uaData?.mobile === true) return true;

  // 3) iPadOS 13+ 위장 케이스(Macintosh인데 멀티터치) 보정.
  if (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1) return true;

  // 4) 최후 폴백 — 터치 위주 기기(coarse pointer + 실제 터치포인트).
  const coarse =
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(pointer: coarse)").matches;
  return coarse && navigator.maxTouchPoints > 0;
}

// iOS(iPhone/iPad, iPadOS 위장 포함) 여부.
export function isIOS(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent || "";
  if (/iP(hone|od|ad)/.test(ua)) return true;
  return /Macintosh/.test(ua) && navigator.maxTouchPoints > 1; // iPadOS 13+ 위장
}

// 홈 화면 추가(PWA)로 실행 중인지 — standalone/fullscreen 이면 이미 설치 실행.
export function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  const nav = navigator as Navigator & { standalone?: boolean };
  if (nav.standalone === true) return true; // iOS Safari 홈화면 실행
  return (
    typeof window.matchMedia === "function" &&
    (window.matchMedia("(display-mode: standalone)").matches ||
      window.matchMedia("(display-mode: fullscreen)").matches)
  );
}

interface PermissionRequestable {
  requestPermission?: () => Promise<PermissionState | string>;
}

/**
 * 전체화면(몰입) 진입 — 반드시 사용자 제스처(탭) 안에서 호출.
 *   안드로이드 크롬 등은 이걸로 브라우저(미설치) 상태에서도 상태바/주소창 없이 몰입된다.
 *   iOS Safari(iPhone)는 Fullscreen API 미지원 → 조용히 무시(홈 화면 추가 PWA 로 대체).
 *   이미 전체화면이거나 실패해도 조용히 넘어간다.
 */
export function enterFullscreen(): void {
  if (typeof document === "undefined") return;
  if (document.fullscreenElement) return; // 이미 전체화면
  const el = document.documentElement as HTMLElement & {
    webkitRequestFullscreen?: () => Promise<void> | void;
  };
  try {
    const req = el.requestFullscreen ?? el.webkitRequestFullscreen;
    const r = req?.call(el);
    if (r && typeof (r as Promise<void>).catch === "function") {
      (r as Promise<void>).catch(() => {});
    }
  } catch {
    // 미지원/거부 → 무시
  }
}

// 전체화면 "유지 의사" 플래그(세션 한정). 사용자가 시작 게이트에서 전체화면에 진입하면 켠다.
//   페이지 이동(AR 진입/복귀)은 Fullscreen API 상태를 해제하므로, 이 플래그가 있으면
//   복귀 후 첫 사용자 제스처에 전체화면을 다시 넣는다(armFullscreenRestore).
const FS_WANTED_KEY = "bookmon-fs-wanted";

export function markFullscreenWanted(): void {
  try {
    sessionStorage.setItem(FS_WANTED_KEY, "1");
  } catch {
    /* 무시 */
  }
}

function isFullscreenWanted(): boolean {
  try {
    return sessionStorage.getItem(FS_WANTED_KEY) === "1";
  } catch {
    return false;
  }
}

/**
 * 전체화면 복원 무장 — 앱 전역에서 1회 호출.
 *   AR 페이지에서 앱으로 **복귀**하면 최상위 이동이라 전체화면이 풀린다.
 *   "유지 의사"가 있고(=시작 게이트에서 진입) 아직 전체화면이 아니면,
 *   **첫 사용자 제스처**(탭)에 전체화면을 다시 넣는다(재진입엔 제스처가 필수).
 *   이미 PWA(standalone/fullscreen) 실행이거나 PC면 아무 것도 하지 않는다.
 *   정리 함수(리스너 해제)를 반환한다.
 */
export function armFullscreenRestore(): () => void {
  if (typeof document === "undefined") return () => {};
  if (!isFullscreenWanted()) return () => {};
  if (isStandalone()) return () => {}; // PWA 실행은 이미 몰입 — 불필요
  if (!isMobileDevice()) return () => {};

  const restore = () => {
    if (document.fullscreenElement) {
      cleanup();
      return;
    }
    enterFullscreen();
    cleanup();
  };
  const cleanup = () => {
    document.removeEventListener("pointerdown", restore, true);
    document.removeEventListener("touchend", restore, true);
    document.removeEventListener("click", restore, true);
  };
  document.addEventListener("pointerdown", restore, true);
  document.addEventListener("touchend", restore, true);
  document.addEventListener("click", restore, true);
  return cleanup;
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
