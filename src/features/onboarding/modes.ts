import type { GameMode } from "@/types";

/**
 * BM-101 실행모드 정의 (톤앤매너: 실행모드=파랑, 행사모드=주황).
 * 문구·색·아이콘·다음 경로를 데이터로 분리 → UI를 건드리지 않고 여기만 고치면 됨.
 * NOTE: 표시 라벨은 참고 이미지에 맞춰 "실행모드"로 표기하되, 내부 모드 키(practice)와
 *       분기 로직(next 라우팅 등)은 그대로 유지한다.
 */
export interface ModeOption {
  mode: GameMode;
  label: string;
  variant: "primary" | "gold"; // 체험=스카이블루 / 행사=골드
  icon: "search" | "flag";
  next?: string; // 선택 후 이동할 라우트(체험만). 실전은 같은 페이지에서 학교 단계로 전환.
}

export const MODE_OPTIONS: ModeOption[] = [
  {
    mode: "practice",
    label: "실행모드",
    variant: "primary",
    icon: "search",
    next: "/play", // 학교·모둠 생략, 현재 위치 기준 OSM 실지도(실행모드)로 바로 진입
  },
  {
    mode: "real",
    label: "행사모드",
    variant: "gold",
    icon: "flag",
    // next 없음 — 라우트 이동 대신 / 페이지 안에서 학교 선택 단계로 전환(OnboardingFlow)
  },
];
