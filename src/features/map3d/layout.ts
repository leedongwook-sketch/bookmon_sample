import type { EventMap, Game, GameLocation, GroundLayout, GroundPoint } from "@/types";
import { projectToImage } from "@/features/map/geo";

// 3D 지면 좌표 계산.
//
// 기존 2D의 projectToImage(앵커 2점 → 이미지 비율 x,y 0~1)를 그대로 재사용하고,
// 그 비율을 three world의 XZ 평면 좌표로 변환한다. (Y=위, 지면 y=0)
//   - 평면 가로 = 1로 정규화, 세로 = 이미지 종횡비(h/w).
//   - 이미지 (0,0)=좌상 → world (-W/2, -D/2), (1,1)=우하 → (+W/2, +D/2).
//   - 이미지 y가 커질수록 화면상 '아래(먼 곳)'이므로 worldZ가 +로 증가한다.
//
// 결과(GroundLayout)는 gameStore에 캐시로 저장되어 3D 씬이 소비한다.

// 이미지 비율(x,y) → world (X,Z). 평면 크기(planeWidth/Depth) 기준 중앙 정렬.
export function ratioToWorld(
  x: number,
  y: number,
  planeWidth: number,
  planeDepth: number
): { worldX: number; worldZ: number } {
  return {
    worldX: (x - 0.5) * planeWidth,
    worldZ: (y - 0.5) * planeDepth,
  };
}

function toGroundPoint(
  id: string,
  loc: GameLocation,
  anchors: EventMap["anchors"],
  planeWidth: number,
  planeDepth: number
): GroundPoint {
  const { x, y } = projectToImage(anchors, loc.latitude, loc.longitude);
  const { worldX, worldZ } = ratioToWorld(x, y, planeWidth, planeDepth);
  return { id, x, y, worldX, worldZ };
}

// 지도 이미지 자연 크기(natural)를 알아야 종횡비를 잡는다. 로드 후 계산한다.
export function computeGroundLayout(
  eventMap: EventMap,
  games: Game[],
  myPos: GameLocation,
  natural: { w: number; h: number }
): GroundLayout {
  const planeWidth = 1;
  const planeDepth = natural.w > 0 ? natural.h / natural.w : 1;

  const monsters = games.map((g) =>
    toGroundPoint(g.id, g.location, eventMap.anchors, planeWidth, planeDepth)
  );
  const me = toGroundPoint("me", myPos, eventMap.anchors, planeWidth, planeDepth);

  return { planeWidth, planeDepth, monsters, me };
}
