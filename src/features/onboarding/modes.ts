import type { GameMode } from "@/types";

/**
 * BM-101 실행모드 정의 (톤앤매너: 체험=스카이블루/돋보기, 행사=골드/깃발).
 * 문구·색·아이콘·다음 경로를 데이터로 분리 → UI를 건드리지 않고 여기만 고치면 됨.
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
    label: "체험모드",
    variant: "primary",
    icon: "search",
    next: "/map", // 학교·모둠 생략하고 바로 시작
  },
  {
    mode: "real",
    label: "행사모드",
    variant: "gold",
    icon: "flag",
    // next 없음 — 라우트 이동 대신 / 페이지 안에서 학교 선택 단계로 전환(SchoolSearchScreen)
  },
];
