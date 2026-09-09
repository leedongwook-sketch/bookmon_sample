import type { Game, GameLocation, Monster, Quiz } from "@/types";

// 실행모드(자유 플레이) 전용 데이터 — 서버 없이 클라이언트에서 임의 구성한다.
//   내 현재 위치 주변에 랜덤으로 몬스터 1마리를 생성해 배치한다(행사모드와 달리 고정 배치 아님).
//   몬스터/퀴즈는 아래 풀에서 무작위로 뽑아 조합한다.

// 실행모드 몬스터/퀴즈 임시 썸네일(도감/AR 공용) — mock 과 동일한 번들 이미지.
const TEST_THUMB = "/ar/shooting/assets/bookmon1.png";

// 몬스터 풀 (koreanName/codeName 만 다르게 — 이미지·스프라이트는 공용 테스트 리소스).
const MONSTER_POOL: Omit<Monster, "id">[] = [
  { koreanName: "불꽃 북몬", englishName: "Fire Bookmon", codeName: "FIRE" },
  { koreanName: "물방울 북몬", englishName: "Water Bookmon", codeName: "WATER" },
  { koreanName: "새싹 북몬", englishName: "Sprout Bookmon", codeName: "SPROUT" },
  { koreanName: "바람 북몬", englishName: "Wind Bookmon", codeName: "WIND" },
  { koreanName: "번개 북몬", englishName: "Bolt Bookmon", codeName: "BOLT" },
].map((m) => ({
  ...m,
  thumbnail64Url: null,
  thumbnail128Url: TEST_THUMB,
  thumbnail256Url: null,
  spriteIdleUrl: null,
  spriteLeftUrl: null,
  spriteRightUrl: null,
  spriteHitUrl: null,
}));

// 퀴즈 풀 (CHOICE·OX 혼합) — answer 는 1-based.
const QUIZ_POOL: Omit<Quiz, "id">[] = [
  {
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
  {
    content: "식물이 자라는 데 꼭 필요한 것은?",
    type: "CHOICE",
    choice1: "햇빛",
    choice2: "어둠",
    choice3: "소금",
    choice4: "돌멩이",
    answer: 1,
    description: "식물이 자라려면 햇빛이 꼭 필요해요.",
    imageUrl: null,
  },
  {
    content: "바람은 공기가 움직여서 생기는 것이다.",
    type: "OX",
    choice1: "O (맞다)",
    choice2: "X (틀리다)",
    choice3: null,
    choice4: null,
    answer: 1,
    description: "바람은 공기의 움직임(기압 차)으로 생겨요.",
    imageUrl: null,
  },
  {
    content: "해는 서쪽에서 뜬다.",
    type: "OX",
    choice1: "O (맞다)",
    choice2: "X (틀리다)",
    choice3: null,
    choice4: null,
    answer: 2,
    description: "해는 동쪽에서 떠서 서쪽으로 져요.",
    imageUrl: null,
  },
];

// 내 위치에서 bearing(도)·distance(m) 만큼 떨어진 좌표. (소규모 반경이라 평면 근사로 충분)
function offset(
  from: GameLocation,
  bearingDeg: number,
  distanceM: number
): GameLocation {
  const rad = (bearingDeg * Math.PI) / 180;
  const dNorth = Math.cos(rad) * distanceM; // 북(+)
  const dEast = Math.sin(rad) * distanceM; // 동(+)
  return {
    latitude: from.latitude + dNorth / 111_320,
    longitude:
      from.longitude +
      dEast / (111_320 * Math.cos((from.latitude * Math.PI) / 180)),
  };
}

// 내 위치 주변에 랜덤 몬스터 1마리를 생성한다.
//   - 방향: 0~360° 랜덤, 거리: 15~35m(도착 반경 10m 밖 → 걸어가서 근접 조우).
//   - id 는 매번 고유(seq)라 도감/조우 중복 없이 계속 새로 생성된다.
//   - index 로 변주(부호 없는 난수 대용): 호출부가 증가 seq 를 넘겨 같은 위치 반복 방지.
export function generateMonsterNear(pos: GameLocation, seq: number): Game {
  const monster = MONSTER_POOL[Math.floor(rnd(seq * 7 + 1) * MONSTER_POOL.length)];
  const quiz = QUIZ_POOL[Math.floor(rnd(seq * 13 + 3) * QUIZ_POOL.length)];
  const bearing = rnd(seq * 31 + 5) * 360;
  const distance = 15 + rnd(seq * 17 + 9) * 20; // 15~35m
  return {
    id: `practice_${seq}`,
    monster: { ...monster, id: `practice_mon_${seq}` },
    quiz: { ...quiz, id: `practice_quiz_${seq}` },
    location: offset(pos, bearing, distance),
  };
}

// 결정적 의사난수 [0,1) — Math.random() 은 이 코드베이스에서 금지(SSR/resume) 되진 않으나,
// seq 기반으로 두면 재현/디버그가 쉽다. (단순 해시)
function rnd(n: number): number {
  const x = Math.sin(n * 12.9898) * 43758.5453;
  return x - Math.floor(x);
}
