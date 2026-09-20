import type {
  EventMap,
  Game,
  GameLocation,
  Monster,
  PlayGroup,
  Quiz,
  SchoolSearchResult,
} from "@/types";

// 체험모드(자유 플레이) — 서버에서 학교/모둠/게임을 가져오지 않고 **정적 데이터를 하드코딩**해
//   행사모드와 **동일하게** gameStore(sessionStorage)에 setGameData 로 세팅한다. 지도 진입 이후의
//   모든 흐름·기능(2D/3D 지도·근접 조우·AR·퀴즈·도감)은 행사모드와 같은 코드 경로를 공유하고,
//   차이는 오직 "게임데이터의 출처(서버 vs 하드코딩)"뿐이다.
//   · 몬스터 위치만 최초 GPS 픽스 기준으로 합성(아무 데서나 테스트 가능 — 방식 B).
//   · 이미지/스프라이트/퀴즈는 하드코딩 고정(서버가 줬을 값을 그대로 박아둠).

// ⚠ 테스트 리소스(bookmon_design 유래) — 실 전환 시 test-sprites 폴더째 삭제.
const FIX_IMG = "/images/monster/test-sprites/bookmon_01.png"; // 도감·AR 대표/폴백
const FIX_SPRITE_IDLE = "/images/monster/test-sprites/P_idle.png";
const FIX_SPRITE_L = "/images/monster/test-sprites/P_run_L.png";
const FIX_SPRITE_R = "/images/monster/test-sprites/P_run_R.png";

// 체험모드 지도 이미지 — 용인초 일러스트(900×960). 이미지가 덮는 실측 영역 가정(m).
const PRACTICE_MAP_URL = "/images/practice-map.svg";
const SPAN_X_M = 150;
const SPAN_Y_M = 160;

// 정적 학교/모둠 — 서버 응답과 동일 shape(행사모드 setGameData 자리에 그대로 들어감).
export const PRACTICE_SCHOOL: SchoolSearchResult = {
  id: "practice_event",
  place: "체험 모드",
};
export const PRACTICE_GROUP: PlayGroup = {
  id: "practice_group",
  name: "체험",
  startpoint: 1,
};

// 체험모드 퀴즈 — 단일 고정 문항.
const PRACTICE_QUIZ: Omit<Quiz, "id"> = {
  content: "책의 정령몬스터들을 찾아 떠나는, 이 독서 행사의 이름은?",
  type: "CHOICE",
  choice1: "BOOKMAN",
  choice2: "BOOKMON",
  choice3: "BOOKMOM",
  choice4: "BOOKMONG",
  answer: 2,
  description: "정답은 BOOKMON(북몬)이에요!",
  imageUrl: null,
};

// 몬스터 비주얼 공통(이름만 다르고 이미지·스프라이트는 동일 고정 리소스).
const VISUAL: Omit<Monster, "id" | "koreanName" | "englishName" | "codeName"> = {
  thumbnail64Url: null,
  thumbnail128Url: FIX_IMG, // 도감 썸네일
  thumbnail256Url: FIX_IMG, // AR 대표 이미지(arBridge → AR)
  spriteIdleUrl: FIX_SPRITE_IDLE,
  spriteLeftUrl: FIX_SPRITE_L,
  spriteRightUrl: FIX_SPRITE_R,
  spriteHitUrl: null,
};

// 고정 몬스터 로스터 — 이름/코드 + 내 위치 기준 배치(방위·거리). (정적: 매번 동일)
const ROSTER: { koreanName: string; englishName: string; codeName: string; bearing: number; distance: number }[] = [
  { koreanName: "불꽃 북몬", englishName: "Fire Bookmon", codeName: "FIRE", bearing: 45, distance: 14 },
  { koreanName: "물방울 북몬", englishName: "Water Bookmon", codeName: "WATER", bearing: 135, distance: 16 },
  { koreanName: "새싹 북몬", englishName: "Sprout Bookmon", codeName: "SPROUT", bearing: 225, distance: 15 },
  { koreanName: "바람 북몬", englishName: "Wind Bookmon", codeName: "WIND", bearing: 315, distance: 17 },
];

// 내 위치에서 bearing(도)·distance(m) 떨어진 좌표(소규모 반경 평면 근사).
function offset(from: GameLocation, bearingDeg: number, distanceM: number): GameLocation {
  const rad = (bearingDeg * Math.PI) / 180;
  const dNorth = Math.cos(rad) * distanceM;
  const dEast = Math.sin(rad) * distanceM;
  return {
    latitude: from.latitude + dNorth / 111_320,
    longitude: from.longitude + dEast / (111_320 * Math.cos((from.latitude * Math.PI) / 180)),
  };
}

// 최초 픽스(center)를 이미지 중심으로 두는 합성 EventMap(행사모드 앵커와 동일 구조 NW(0,0)/SE(1,1)).
function synthesizeEventMap(center: GameLocation): EventMap {
  const halfLat = SPAN_Y_M / 2 / 111_320;
  const halfLng = SPAN_X_M / 2 / (111_320 * Math.cos((center.latitude * Math.PI) / 180));
  return {
    imageUrl: PRACTICE_MAP_URL,
    anchors: [
      { x: 0, y: 0, latitude: center.latitude + halfLat, longitude: center.longitude - halfLng },
      { x: 1, y: 1, latitude: center.latitude - halfLat, longitude: center.longitude + halfLng },
    ],
  };
}

// 정적 체험 게임데이터 번들 — origin(최초 GPS 픽스) 기준으로 구성.
//   행사모드의 서버 응답(학교/모둠/게임/지도)을 대체하는 하드코딩 세트. setGameData 로 주입한다.
export function buildPracticeGameData(origin: GameLocation): {
  school: SchoolSearchResult;
  group: PlayGroup;
  games: Game[];
  eventMap: EventMap;
} {
  const games: Game[] = ROSTER.map((r, i) => ({
    id: `practice_${i + 1}`,
    monster: {
      id: `practice_mon_${i + 1}`,
      koreanName: r.koreanName,
      englishName: r.englishName,
      codeName: r.codeName,
      ...VISUAL,
    },
    quiz: { id: `practice_quiz_${i + 1}`, ...PRACTICE_QUIZ },
    location: offset(origin, r.bearing, r.distance),
  }));
  return {
    school: PRACTICE_SCHOOL,
    group: PRACTICE_GROUP,
    games,
    eventMap: synthesizeEventMap(origin),
  };
}
