import type { GameMode, QuizResult, GeoPoint } from "./common";
import type { Monster } from "./catalog";

// 런타임(플레이) 데이터 — 태블릿이 활동하며 생성/전송.
// ⚠ v0.2 예시. API 명세 확정 시 변경될 수 있음.

// 플레이 컨텍스트 — 개인 로그인이 없으므로 "활동 주체" 역할을 한다.
// API가 행사(event)·모둠(group)을 문자열 ID로 다루므로 그에 맞춘다.
export interface PlayContext {
  eventId: string; // 선택한 행사(학교) ID
  groupId: string; // 선택한 모둠 ID
  mode: GameMode;
}

// 실시간 내 위치 — 서버가 아니라 디바이스 센서(GPS/나침반)에서 나온다. 클라이언트 전용.
export interface PlayerState {
  location: GeoPoint;
  heading: number; // 0~360°, 지도 회전용
}

// 포획 시도 기록 (BM-404~406) → POST 전송
export interface Capture {
  captureId: string;
  eventId: string;
  groupId: string;
  gameId: string; // 배치(게임) ID
  photoUri: string; // ⚠ 아동 초상 포함 가능 — 개인정보 처리 검토 필요
  photoScore: number;
  quizResult: QuizResult;
  attemptCount: number;
  capturedAt: string;
}

// 도감 항목 (BM-301/302)
export interface CollectionEntry {
  monsterId: string;
  koreanName: string; // 몬스터명(도감 접근성/표시용)
  imageUrl: string | null; // 도감 카드에 보여줄 몬스터 이미지 경로(썸네일)
  acquired: boolean; // 미획득 = 노란 "?" 카드
  acquiredAt: string | null;
}

// 활동 결과 요약 (BM-501)
export interface ActivityResult {
  eventId: string;
  groupId: string;
  collectedCount: number; // 수집 n
  totalCount: number; // 전체
  correctRate: number; // 정답률
  durationSec: number; // 총 소요시간
  monsters: Monster[]; // 획득 북몬 목록
  rank?: number; // 모둠 순위 [추정]
}
