import type {
  SchoolSearchResult,
  PlayGroup,
  Game,
  EventMap,
  EventDetail,
} from "@/types";
import { http } from "@/lib/http";
import { API_BASE_URL } from "@/lib/env";
import type { SchoolService } from "./schoolService";

// 서버 지도 이미지 경로를 로드 가능한 URL로 보정(상대경로면 API 도메인 prepend).
function resolveMapImageUrl(mapImageUrl: string | null): string {
  if (!mapImageUrl) return "";
  return /^https?:\/\//.test(mapImageUrl)
    ? mapImageUrl
    : `${API_BASE_URL}${mapImageUrl}`;
}

// 서버 EventDetail(bbox) → 프론트 EventMap(2앵커) 변환.
//   NW(x=0,y=0)=(north,west), SE(x=1,y=1)=(south,east). 정북·직사각형 가정(무손실).
function eventDetailToEventMap(ev: EventDetail): EventMap {
  const { north, south, east, west } = ev.gps;
  return {
    imageUrl: resolveMapImageUrl(ev.mapImageUrl),
    anchors: [
      { x: 0, y: 0, latitude: north, longitude: west }, // 북서(좌상)
      { x: 1, y: 1, latitude: south, longitude: east }, // 남동(우하)
    ],
  };
}

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

  // GET /play/events/{eventId} — 행사 상세(지도+GPS bbox)를 받아 EventMap으로 변환.
  getEventMap: async (eventId) => {
    const ev = await http<EventDetail>(
      `/play/events/${encodeURIComponent(eventId)}`
    );
    return eventDetailToEventMap(ev);
  },
};
