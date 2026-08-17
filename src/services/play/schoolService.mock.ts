import type { SchoolSearchResult, PlayGroup, Game, EventMap } from "@/types";
import type { SchoolService } from "./schoolService";

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// ⚠ 테스트 데이터 — 실서버 전환 시 이 파일(*.mock.ts) 삭제.
// 경기 전역 실제 초등학교(여러 시). 첫 항목 용인초등학교(용인)가 11월 실제 테스트 행사장이며
// 아래 MOCK_EVENT_MAP / MOCK_GAMES 좌표가 이 학교 실제 부지(OSM bbox)에 연결돼 있다.
const MOCK_SCHOOLS: SchoolSearchResult[] = [
  { id: "evt_yongin_yongin", place: "용인초등학교" }, // 용인 (테스트 행사장)
  { id: "evt_suwon_suwon", place: "수원초등학교" }, // 수원
  { id: "evt_seongnam_seongnam", place: "성남초등학교" }, // 성남
  { id: "evt_gunpo_gwangjeong", place: "광정초등학교" }, // 군포
  { id: "evt_bucheon_bucheon", place: "부천초등학교" }, // 부천
  { id: "evt_anyang_pyeongchon", place: "평촌초등학교" }, // 안양
  { id: "evt_suwon_hwaseo", place: "화서초등학교" }, // 수원
  { id: "evt_bucheon_songnae", place: "송내초등학교" }, // 부천
];

// 모둠 1~20 (화면정의서: 모둠 번호 1~20). 디자인 group_num 그리드에 맞춤.
const MOCK_GROUPS: PlayGroup[] = Array.from({ length: 20 }, (_, i) => ({
  id: `grp_${i + 1}`,
  name: `${i + 1}조`,
}));

// 용인초등학교(용인 처인구 김량장동) 행사장 지도 — 시작 시 GET /play/events/{eventId}/map 로 내려줄 데이터.
// yongin-map.svg = 해당 학교 스타일 지도(정북 기준). 앵커 2점 = 실제 부지(OSM bbox) 대각 모서리.
//   bbox: 위도 [37.2373587, 37.2390036], 경도 [127.2042943, 127.2060563]
// x,y는 SVG 속 부지 경계(빨간 선)의 실측 위치 비율(래스터화 측정) → 코너가 아닌 경계에 맞춤.
// ⚠ SVG 경계는 스타일화된 사변형이라 매핑은 근사(축별 선형). 현장 실측 시 보정.
const MOCK_EVENT_MAP: EventMap = {
  imageUrl: "/images/yongin-map.svg",
  anchors: [
    { x: 0.0392, y: 0.0127, latitude: 37.2390036, longitude: 127.2042943 }, // 북서(경계 좌상)
    { x: 0.9704, y: 0.8886, latitude: 37.2373587, longitude: 127.2060563 }, // 남동(경계 우하)
  ],
};

// 아래 몬스터 좌표는 모두 위 부지(bbox) 안의 실좌표.
const MOCK_GAMES: Game[] = [
  {
    id: "game_1",
    monster: {
      id: "mon_fire",
      koreanName: "불꽃 북몬",
      englishName: "Fire Bookmon",
      codeName: "FIRE_BOOKMON",
      thumbnail64Url: null,
      thumbnail128Url: "/ar/assets/bookmon1.png", // ⚠ 테스트 임시 썸네일(도감용) — 실서버 전환 시 null로
      thumbnail256Url: null,
      spriteIdleUrl: null,
      spriteLeftUrl: null,
      spriteRightUrl: null,
      spriteHitUrl: null,
    },
    quiz: {
      id: "quiz_1",
      content: "불은 어떤 성질을 가지고 있을까요?",
      type: "MULTIPLE_CHOICE",
      choice1: "차갑다",
      choice2: "뜨겁다",
      choice3: "축축하다",
      choice4: "딱딱하다",
      answer: 2,
    },
    location: { latitude: 37.2377, longitude: 127.2047 }, // 용인초 운동장 남서쪽
  },
  {
    id: "game_2",
    monster: {
      id: "mon_water",
      koreanName: "물방울 북몬",
      englishName: "Water Bookmon",
      codeName: "WATER_BOOKMON",
      thumbnail64Url: null,
      thumbnail128Url: "/ar/assets/bookmon1.png", // ⚠ 테스트 임시 썸네일(도감용) — 실서버 전환 시 null로
      thumbnail256Url: null,
      spriteIdleUrl: null,
      spriteLeftUrl: null,
      spriteRightUrl: null,
      spriteHitUrl: null,
    },
    quiz: {
      id: "quiz_2",
      content: "물이 얼면 무엇이 될까요?",
      type: "MULTIPLE_CHOICE",
      choice1: "수증기",
      choice2: "얼음",
      choice3: "구름",
      choice4: "비",
      answer: 2,
    },
    location: { latitude: 37.2384341, longitude: 127.205158 }, // 용인초 중앙(본관 앞)
  },
  {
    id: "game_3",
    monster: {
      id: "mon_forest",
      koreanName: "새싹 북몬",
      englishName: "Sprout Bookmon",
      codeName: "SPROUT_BOOKMON",
      thumbnail64Url: null,
      thumbnail128Url: "/ar/assets/bookmon1.png", // ⚠ 테스트 임시 썸네일(도감용) — 실서버 전환 시 null로
      thumbnail256Url: null,
      spriteIdleUrl: null,
      spriteLeftUrl: null,
      spriteRightUrl: null,
      spriteHitUrl: null,
    },
    quiz: {
      id: "quiz_3",
      content: "식물이 자라는 데 꼭 필요한 것은 무엇일까요?",
      type: "MULTIPLE_CHOICE",
      choice1: "햇빛",
      choice2: "어둠",
      choice3: "소금",
      choice4: "돌멩이",
      answer: 1,
    },
    location: { latitude: 37.2388, longitude: 127.2058 }, // 용인초 북동쪽
  },
];

/**
 * 테스트 구현. 실서버와 동일한 반환 타입이라 훅/UI는 mock/real을 구분하지 못한다.
 */
export const mockSchoolService: SchoolService = {
  searchSchools: async (keyword) => {
    await delay(400); // 네트워크 지연 흉내
    const q = keyword.trim();
    if (!q) return [];
    return MOCK_SCHOOLS.filter((school) => school.place.includes(q));
  },

  getGroups: async (eventId) => {
    await delay(400);
    void eventId; // 현재는 eventId와 무관하게 동일 목록 반환
    return MOCK_GROUPS;
  },

  getGames: async (groupId) => {
    await delay(400);
    void groupId; // 현재는 groupId와 무관하게 동일 게임 반환
    return MOCK_GAMES;
  },

  getEventMap: async (eventId) => {
    await delay(400);
    void eventId; // 현재는 eventId와 무관하게 용인초 지도 반환
    return MOCK_EVENT_MAP;
  },
};
