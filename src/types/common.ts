// 공통 타입 — 여러 도메인에서 재사용
// ⚠ v0.1 예시. 기획 확정 시 변경될 수 있음.

export interface GeoPoint {
  lat: number;
  lng: number;
}

export type GameMode = "practice" | "real"; // 연습 / 실전

// 퀴즈 형식. ⚠ API 명세 상 값 혼재(/play="MULTIPLE_CHOICE", 관리자="FOUR") → 확정 필요.
export type QuizType = "MULTIPLE_CHOICE" | "FOUR" | "OX";

export type QuizResult = "correct" | "wrong" | "timeout";

// 비동기 요청 UI 상태 (모든 데이터 훅 공용)
export type AsyncStatus = "idle" | "loading" | "success" | "error";

// 서버 공통 응답 래퍼 (백엔드가 사용할 경우)
export interface ApiResponse<T> {
  data: T;
  code: string;
  message: string;
}
