import type { SchoolSearchResult, PlayGroup, Game, EventMap } from "@/types";
import { USE_MOCK } from "@/lib/env";
import { httpSchoolService } from "./schoolService.http";
import { mockSchoolService } from "./schoolService.mock";

/**
 * 태블릿 play flow 서비스 (도메인 단위 통합).
 * 학교 검색 · 모둠 조회 + 이후 게임 조회도 이 포트에 메서드로 추가한다.
 * 호출부(훅/UI)는 이 계약에만 의존한다.
 */
export interface SchoolService {
  /** GET /play/schools?keyword= */
  searchSchools(keyword: string): Promise<SchoolSearchResult[]>;
  /** GET /play/events/{eventId}/groups */
  getGroups(eventId: string): Promise<PlayGroup[]>;
  /** GET /play/groups/{groupId}/games */
  getGames(groupId: string): Promise<Game[]>;
  /** GET /play/events/{eventId} — 행사 상세(지도 이미지 + GPS bbox)를 EventMap(2앵커)으로 변환해 반환. */
  getEventMap(eventId: string): Promise<EventMap>;
}

// 🔻 데이터 소스 바인딩 (부분 연동).
//   - USE_MOCK=true  → 전체 mock (오프라인/전체 테스트 모드).
//   - 그 외(기본)    → **"모둠 선택까지"(schools·groups)만 실서버**, 게임/지도는 아직 API 미연동이라 mock 유지.
// 게임/지도 API가 준비되면 아래 mock 라인을 httpSchoolService 로 바꾸면 된다(그때 mock 삭제 가능).
export const schoolService: SchoolService = USE_MOCK
  ? mockSchoolService
  : {
      searchSchools: httpSchoolService.searchSchools, // 실서버 GET /play/schools?keyword=
      getGroups: httpSchoolService.getGroups, // 실서버 GET /play/events/{eventId}/groups
      getGames: mockSchoolService.getGames, // mock — 게임 API 미연동
      getEventMap: mockSchoolService.getEventMap, // mock — 지도 API 미정
    };
