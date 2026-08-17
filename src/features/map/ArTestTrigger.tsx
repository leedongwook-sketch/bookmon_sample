"use client";

// ⚠⚠ 테스트 전용 — 실 프로세스에서는 GPS 도착 판정이 AR을 트리거한다.
//   이 파일과 MapScreen의 <ArTestTriggers .../> 사용처 1줄만 지우면 코어에 영향 없음.
//   (코어 조우 흐름 beginEncounter는 그대로 유지됨)

import type { EventMap, Game } from "@/types";
import { projectToImage } from "./geo";

/**
 * 각 몬스터 위치에 투명 클릭 핫스팟을 얹어, 클릭 시 조우(beginEncounter)를 수동 트리거한다.
 * 지도 레이어 안에 렌더해야 마커와 같은 좌표계로 정렬된다.
 */
export function ArTestTriggers({
  games,
  eventMap,
  onTrigger,
}: {
  games: Game[];
  eventMap: EventMap;
  onTrigger: (game: Game) => void;
}) {
  return (
    <>
      {games.map((game) => {
        const { x, y } = projectToImage(
          eventMap.anchors,
          game.location.latitude,
          game.location.longitude
        );
        return (
          <button
            key={game.id}
            type="button"
            aria-label={`${game.monster.koreanName} (테스트 트리거)`}
            onPointerDown={(e) => e.stopPropagation()} // 지도 드래그로 번지지 않게
            onClick={() => onTrigger(game)}
            className="absolute h-12 w-12 -translate-x-1/2 -translate-y-1/2 cursor-pointer rounded-full bg-transparent"
            style={{ left: `${x * 100}%`, top: `${y * 100}%` }}
          />
        );
      })}
    </>
  );
}
