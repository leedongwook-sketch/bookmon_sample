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
  /** GET /play/events/{eventId}/map — 행사장 지도(이미지 + 2점 앵커). 시작 시 조회. */
  getEventMap(eventId: string): Promise<EventMap>;
}

// 🔻 데이터 소스 스왑 지점.
// 실서버 준비되면: lib/env.ts의 USE_MOCK=false (또는 httpSchoolService로 고정하고 mock 삭제).
export const schoolService: SchoolService = USE_MOCK
  ? mockSchoolService
  : httpSchoolService;
