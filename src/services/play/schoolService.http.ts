import type { SchoolSearchResult, PlayGroup, Game, EventMap } from "@/types";
import { http } from "@/lib/http";
import type { SchoolService } from "./schoolService";

/**
 * 실서버 구현. 명세 그대로 작성 → 스왑 시 즉시 동작. (Auth 불필요)
 */
export const httpSchoolService: SchoolService = {
  searchSchools: (keyword) =>
    http<SchoolSearchResult[]>(
      `/play/schools?keyword=${encodeURIComponent(keyword)}`
    ),

  getGroups: (eventId) =>
    http<PlayGroup[]>(`/play/events/${encodeURIComponent(eventId)}/groups`),

  getGames: (groupId) =>
    http<Game[]>(`/play/groups/${encodeURIComponent(groupId)}/games`),

  getEventMap: (eventId) =>
    http<EventMap>(`/play/events/${encodeURIComponent(eventId)}/map`),
};
