// 게임 공통 파라미터 / 디자인 상수 (화면정의서 6장 기준)
// ⚠ [추정] 값들은 기획 확정 필요 — 데이터모델/화면정의서 「확인 필요 항목」 참조.

/** 상태 컬러 (globals.css 토큰과 동일 의미) */
export const COLORS = {
  wood: "#8b5a2b",
  cream: "#ffe9a8",
  success: "#3bb54a", // 성공/진행/연습모드
  real: "#f5871f", // 실전모드
  warning: "#e23c3c", // 경고
} as const;

/** 기준 해상도 — 태블릿 16:10 가로 (화면정의서 6장) */
export const BASE_RESOLUTION = { width: 1920, height: 1200 } as const;

/** 게임 규칙 [추정] — 확정 전까지 임시값 */
export const GAME_RULES = {
  captureRadiusMeters: 12, // 획득 반경 R [추정 10~15m]
  arLockOnSeconds: 1.5, // AR 락온 유지 시간 [추정]
  quizTimeLimitSec: 30, // 퀴즈 제한시간 [추정]
  minTouchTargetPx: 48, // 최소 터치 타겟
} as const;
