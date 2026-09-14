import type { SchoolSearchResult, PlayGroup, Game, EventMap } from "@/types";
import type { SchoolService } from "./schoolService";

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// ⚠⚠ [테스트 스프라이트 주입 — AR 계약 v2(ArReq.sprites) 검증용] ⚠⚠
// AR 로 넘길 애니메이션 시트(sprite_Walk) 테스트 경로. 아래 3개 몬스터가 ...TEST_SPRITES("NN") 로 사용.
// 걷어내는 법(3단계):
//   1) 이 상수(TEST_SPRITES) 삭제
//   2) 각 monster 의 `...TEST_SPRITES("NN"),` → spriteIdle/Left/Right/HitUrl: null 로 복구
//   3) public/images/monster/test-sprites/ 폴더 삭제
// 경로 규칙: /images 접두는 gh-pages-rewrite 가 배포 시 basePath 프리픽스(로컬 "" · 배포 "/bookmon_sample").
const TEST_SPRITES = (n: string) => ({
  spriteIdleUrl: `/images/monster/test-sprites/${n}_idle.png`,
  spriteLeftUrl: `/images/monster/test-sprites/${n}_run_L.png`,
  spriteRightUrl: `/images/monster/test-sprites/${n}_run_R.png`,
  spriteHitUrl: null, // hit 시트 미제공 → "" 전달됨
});

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
// startpoint(시작 핀, 1-based) — 테스트로 모둠마다 다르게(게임 4개 기준 1~4 순환) 부여해
// 모둠별 시작 위치 순환이 동작하는지 확인한다.
const MOCK_GROUPS: PlayGroup[] = Array.from({ length: 20 }, (_, i) => ({
  id: `grp_${i + 1}`,
  name: `${i + 1}조`,
  startpoint: (i % 4) + 1,
}));

// 테스트 행사장 지도 — map.osm(OSM 내보내기) 영역을 OSM 타일로 렌더해 만든 실지도 PNG.
//   scripts 로 tile.openstreetmap.org 타일을 bbox 에 정확히 맞춰 잘라 생성(© OpenStreetMap).
//   bbox: 위도 [37.3647360, 37.3664570], 경도 [126.9294180, 126.9327090] (경명여중 일대)
//   이미지가 bbox 에 정확히 대응하므로 앵커 = 이미지 4모서리(정북·직사각형): NW(0,0), SE(1,1).
const MOCK_EVENT_MAP: EventMap = {
  imageUrl: "/images/test-map.png",
  anchors: [
    { x: 0, y: 0, latitude: 37.366457, longitude: 126.929418 }, // 북서(좌상)
    { x: 1, y: 1, latitude: 37.364736, longitude: 126.932709 }, // 남동(우하)
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
      thumbnail128Url: "/ar/shooting/assets/bookmon1.png", // ⚠ 테스트 임시 썸네일(도감용, 배포 번들 경로) — 실서버 전환 시 null로
      thumbnail256Url: null,
      ...TEST_SPRITES("01"), // ⚠ 테스트 스프라이트 — 종료 시 sprite*Url:null 로 복구
    },
    quiz: {
      id: "quiz_1",
      content: "불은 어떤 성질을 가지고 있을까요?",
      type: "CHOICE",
      choice1: "차갑다",
      choice2: "뜨겁다",
      choice3: "축축하다",
      choice4: "딱딱하다",
      answer: 2,
      description: "불은 뜨거운 성질을 가지고 있어요.",
      imageUrl: null,
    },
    location: { latitude: 37.365769, longitude: 126.9308 }, // 부지 북서 (이미지 ~x0.42,y0.40, 중앙서 ~30m)
  },
  {
    id: "game_2",
    monster: {
      id: "mon_water",
      koreanName: "물방울 북몬",
      englishName: "Water Bookmon",
      codeName: "WATER_BOOKMON",
      thumbnail64Url: null,
      thumbnail128Url: "/ar/shooting/assets/bookmon1.png", // ⚠ 테스트 임시 썸네일(도감용, 배포 번들 경로) — 실서버 전환 시 null로
      thumbnail256Url: null,
      ...TEST_SPRITES("02"), // ⚠ 테스트 스프라이트 — 종료 시 sprite*Url:null 로 복구
    },
    quiz: {
      id: "quiz_2",
      content: "물이 얼면 무엇이 될까요?",
      type: "CHOICE",
      choice1: "수증기",
      choice2: "얼음",
      choice3: "구름",
      choice4: "비",
      answer: 2,
      description: "물이 얼면 고체인 얼음이 돼요.",
      imageUrl: null,
    },
    location: { latitude: 37.365683, longitude: 126.931393 }, // 부지 북동 (이미지 ~x0.60,y0.45, 중앙서 ~30m)
  },
  {
    id: "game_3",
    monster: {
      id: "mon_forest",
      koreanName: "새싹 북몬",
      englishName: "Sprout Bookmon",
      codeName: "SPROUT_BOOKMON",
      thumbnail64Url: null,
      thumbnail128Url: "/ar/shooting/assets/bookmon1.png", // ⚠ 테스트 임시 썸네일(도감용, 배포 번들 경로) — 실서버 전환 시 null로
      thumbnail256Url: null,
      ...TEST_SPRITES("03"), // ⚠ 테스트 스프라이트 — 종료 시 sprite*Url:null 로 복구
    },
    quiz: {
      id: "quiz_3",
      content: "식물이 자라는 데 꼭 필요한 것은 무엇일까요?",
      type: "CHOICE",
      choice1: "햇빛",
      choice2: "어둠",
      choice3: "소금",
      choice4: "돌멩이",
      answer: 1,
      description: "식물이 자라려면 햇빛이 꼭 필요해요.",
      imageUrl: null,
    },
    location: { latitude: 37.36539, longitude: 126.930734 }, // 부지 남서 (이미지 ~x0.40,y0.62, 중앙서 ~37m)
  },
  {
    // ⚠ [테스트] OX형 퀴즈 확인용 게임.
    id: "game_4",
    monster: {
      id: "mon_wind",
      koreanName: "바람 북몬",
      englishName: "Wind Bookmon",
      codeName: "WIND_BOOKMON",
      thumbnail64Url: null,
      thumbnail128Url: "/ar/shooting/assets/bookmon1.png", // ⚠ 테스트 임시 썸네일 — 실서버 전환 시 null로
      thumbnail256Url: null,
      ...TEST_SPRITES("01"),
    },
    quiz: {
      id: "quiz_4",
      content: "바람은 공기가 움직여서 생기는 것이다.",
      type: "OX",
      choice1: "O (맞다)",
      choice2: "X (틀리다)",
      choice3: null,
      choice4: null,
      answer: 1, // O 가 정답
      description: "바람은 공기의 움직임(기압 차)으로 생겨요.",
      imageUrl: null,
    },
    location: { latitude: 37.365424, longitude: 126.931327 }, // 부지 남동 (이미지 ~x0.58,y0.60, 중앙서 ~30m)
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
