import type { Game, GameLocation, Monster, Quiz } from "@/types";

// 실행모드(자유 플레이) 전용 데이터 — 서버 없이 클라이언트에서 임의 구성한다.
//   내 현재 위치 주변에 랜덤으로 몬스터 1마리를 생성해 배치한다(행사모드와 달리 고정 배치 아님).
//   몬스터/퀴즈는 아래 풀에서 무작위로 뽑아 조합한다.

// 체험모드 몬스터 이미지 — 테스트 리소스(P 스프라이트 + bookmon_01 도감) 고정.
//   ⚠ 테스트 전용(bookmon_design 유래) — 테스트모드 걷어낼 때 test-sprites 폴더째 삭제.
//   thumbnail128/256 = 도감·AR 대표 이미지(bookmon_01). spriteIdle/Left/Right 는 P 시트 —
//   채워두면 AR 의 dev-seed(핑크 01) 자동 주입이 무력화(hasSprites=true)된다.
const FIX_IMG = "/images/monster/test-sprites/bookmon_01.png";
const FIX_SPRITE_IDLE = "/images/monster/test-sprites/P_idle.png";
const FIX_SPRITE_L = "/images/monster/test-sprites/P_run_L.png";
const FIX_SPRITE_R = "/images/monster/test-sprites/P_run_R.png";

// 몬스터 풀 (koreanName/codeName 만 다르게 — 이미지·스프라이트는 동일 고정 리소스).
const MONSTER_POOL: Omit<Monster, "id">[] = [
  { koreanName: "불꽃 북몬", englishName: "Fire Bookmon", codeName: "FIRE" },
  { koreanName: "물방울 북몬", englishName: "Water Bookmon", codeName: "WATER" },
  { koreanName: "새싹 북몬", englishName: "Sprout Bookmon", codeName: "SPROUT" },
  { koreanName: "바람 북몬", englishName: "Wind Bookmon", codeName: "WIND" },
  { koreanName: "번개 북몬", englishName: "Bolt Bookmon", codeName: "BOLT" },
].map((m) => ({
  ...m,
  thumbnail64Url: null,
  thumbnail128Url: FIX_IMG, // 도감 썸네일
  thumbnail256Url: FIX_IMG, // AR 대표 이미지(arBridge → AR)
  spriteIdleUrl: FIX_SPRITE_IDLE,
  spriteLeftUrl: FIX_SPRITE_L,
  spriteRightUrl: FIX_SPRITE_R,
  spriteHitUrl: null,
}));

// 영속(localStorage) 몬스터의 비주얼 필드를 현재 테스트 리소스로 갱신한다.
//   체험모드 games 는 persist 되므로, 이미지 교체 이전 빌드에서 생성된 몬스터가
//   옛 경로(또는 null)를 물고 남는다 → 조우 시 스프라이트 미적용. 이름/퀴즈/위치는
//   유지하고 이미지·스프라이트만 최신으로 덮어쓴다. (테스트모드 걷어낼 때 함께 제거)
export function refreshMonsterVisuals(game: Game): Game {
  const m = game.monster;
  if (m.spriteIdleUrl === FIX_SPRITE_IDLE && m.thumbnail128Url === FIX_IMG) {
    return game; // 이미 최신
  }
  return {
    ...game,
    monster: {
      ...m,
      thumbnail128Url: FIX_IMG,
      thumbnail256Url: FIX_IMG,
      spriteIdleUrl: FIX_SPRITE_IDLE,
      spriteLeftUrl: FIX_SPRITE_L,
      spriteRightUrl: FIX_SPRITE_R,
      spriteHitUrl: null,
    },
  };
}

// 체험모드 퀴즈 — 단일 고정 문항.
const QUIZ_POOL: Omit<Quiz, "id">[] = [
  {
    content: "책의 정령몬스터들을 찾아 떠나는, 이 독서 행사의 이름은?",
    type: "CHOICE",
    choice1: "BOOKMAN",
    choice2: "BOOKMON",
    choice3: "BOOKMOM",
    choice4: "BOOKMONG",
    answer: 2,
    description: "정답은 BOOKMON(북몬)이에요!",
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
//   - 방향: 0~360° 랜덤, 거리: 12~20m(요구 10~20m, 도착 반경 10m 밖 → 걸어가서 근접 조우.
//     스폰 즉시 발동 방지를 위해 하한을 12m 로 둠).
//   - id 는 매번 고유(seq)라 도감/조우 중복 없이 계속 새로 생성된다.
export function generateMonsterNear(pos: GameLocation, seq: number): Game {
  const monster = MONSTER_POOL[Math.floor(rnd(seq * 7 + 1) * MONSTER_POOL.length)];
  const quiz = QUIZ_POOL[Math.floor(rnd(seq * 13 + 3) * QUIZ_POOL.length)];
  const bearing = rnd(seq * 31 + 5) * 360;
  const distance = 12 + rnd(seq * 17 + 9) * 8; // 12~20m
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
