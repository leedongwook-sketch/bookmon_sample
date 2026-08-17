import type { EventMap, MapAnchor, Game } from "@/types";

// GPS 도착 판정 반경(m) — GPS·지도 구현 방향 문서 §2 (웹 기준 10m).
export const ARRIVAL_RADIUS_M = 10;

// GPS(위경도) → 지도 이미지 위 위치(0~1 비율) 변환.
//
// 앵커 2점이면 성립한다. 지도가 정북(위=북) 정렬이라는 가정하에 x는 경도만,
// y는 위도만으로 각각 선형 보간한다(회전·왜곡 없음). 소규모 부지(수백 m)라
// 경도 cos 왜곡은 무시 가능한 수준.
export function projectToImage(
  anchors: EventMap["anchors"],
  latitude: number,
  longitude: number
): { x: number; y: number } {
  const [a, b] = anchors;
  const x = lerpRatio(longitude, a.longitude, b.longitude, a.x, b.x);
  const y = lerpRatio(latitude, a.latitude, b.latitude, a.y, b.y);
  return { x, y };
}

// value가 [from0,from1] 구간에서 차지하는 위치를 [to0,to1]로 선형 매핑.
function lerpRatio(
  value: number,
  from0: number,
  from1: number,
  to0: number,
  to1: number
): number {
  if (from1 === from0) return to0; // 앵커 두 점의 좌표가 같으면 변환 불가 → 시작점
  return to0 + ((value - from0) / (from1 - from0)) * (to1 - to0);
}

// 좌표가 이미지 밖(부지 경계 밖)인지 — 마킹을 클램프/숨김 처리할 때 사용.
export function isInsideImage(x: number, y: number): boolean {
  return x >= 0 && x <= 1 && y >= 0 && y <= 1;
}

// 두 GPS 좌표 사이 실제 거리(m) — 하버사인.
export function distanceMeters(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const R = 6371000; // 지구 반경(m)
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

// 내 위치 기준 반경 안에 있는 몬스터(게임) 목록. 매 렌더마다 호출해 도착 판정에 사용.
export function getMonstersInRange(
  games: Game[],
  latitude: number,
  longitude: number,
  radiusM: number = ARRIVAL_RADIUS_M
): Game[] {
  return games.filter(
    (g) =>
      distanceMeters(latitude, longitude, g.location.latitude, g.location.longitude) <=
      radiusM
  );
}

export type { MapAnchor };
