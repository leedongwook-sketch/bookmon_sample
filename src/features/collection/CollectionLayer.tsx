"use client";

import { useRef } from "react";
import { useGameStore } from "@/store/gameStore";

// 도감 보드 이미지(벡터). 남색 프레임 + 크림 내부 + 5×4 "?" 칸이 baked된 완성 보드.
const BOARD_SRC = "/images/collection_board.svg";

// board.svg 실측 지오메트리 — viewBox 1382×1124, 칸 215×214, 5열×4행.
// 포획 몬스터 이미지를 이 칸 좌표(%) 위에 얹어 "?"를 덮는다.
const BOARD_W = 1382;
const BOARD_H = 1124;
const CELL_W = 215;
const CELL_H = 214;
const CELL_X = [78, 331, 583, 836, 1089]; // 각 열 좌상단 x
const CELL_Y = [78, 329, 581, 832]; // 각 행 좌상단 y
const CELLS = CELL_Y.flatMap((y) => CELL_X.map((x) => ({ x, y }))); // 좌→우, 상→하 20칸

// 탭으로 인정할 최대 이동 거리(px). 이보다 크게 움직이면 드래그/스크롤 제스처로 보고 닫지 않는다.
const TAP_SLOP_PX = 10;

/**
 * 몬스터 도감 레이어 (모듈형·재사용) — 지도 위 오버레이.
 *  - 완성된 board.svg 한 장을 중앙에 띄운다(정적). "?" 칸이 이미 그림에 포함됨.
 *  - 메뉴(햄버거)와 포획 성공 후 양쪽에서 같은 컴포넌트를 연다.
 *
 * 닫기(모바일 우선): 레이어 아무 곳이나(보드 포함) 탭하면 닫는다. 별도 X 버튼 없음.
 *   - 상위 지도 컨테이너가 touch-none + pointer capture 환경이라, 합성 onClick은
 *     터치에서 억제/누락될 수 있다. 그래서 pointerdown→up을 직접 추적해 닫는다.
 *   - pointerdown 위치를 기록하고 pointerup에서 이동량이 작을 때(탭)만 닫아 드래그 오발을 막는다.
 *   - onPointerDown에서 stopPropagation → 뒤 지도가 드래그되지 않게 한다(기존 취지 유지).
 *   - board.svg가 지금은 정적 view-only라 "보드 탭=닫기"가 기능과 충돌하지 않는다.
 *
 *  - board.svg 위 5×4 칸 좌표(실측)에 포획 몬스터(collection) 이미지를 순서대로 얹어 "?"를 덮는다.
 *
 * TODO(추후): card.svg 기반 칸별 카드 디자인 교체(현재는 board 위 몬스터 이미지 오버레이).
 * TODO(추후): card 칸 상호작용 도입 시 보드 탭-닫기 제거 → 바깥(backdrop) 탭만 닫도록 되돌린다.
 */
export function CollectionLayer({ onClose }: { onClose: () => void }) {
  const collection = useGameStore((s) => s.collection);

  // pointerdown 시작점 — pointerup에서 이동량이 작으면(탭) 닫는다.
  const downRef = useRef<{ x: number; y: number } | null>(null);

  const onDown = (e: React.PointerEvent) => {
    // 뒤 지도가 드래그되지 않게 전파 차단(기존 취지 유지).
    e.stopPropagation();
    downRef.current = { x: e.clientX, y: e.clientY };
  };

  const onUp = (e: React.PointerEvent) => {
    const start = downRef.current;
    downRef.current = null;
    if (!start) return;
    // 탭(이동량 작음)일 때만 닫는다 — 드래그/스크롤성 제스처는 무시.
    const moved = Math.hypot(e.clientX - start.x, e.clientY - start.y);
    if (moved <= TAP_SLOP_PX) onClose();
  };

  return (
    <div
      onPointerDown={onDown}
      onPointerUp={onUp}
      // 레이어 전체 탭으로 닫으므로 자체 제스처를 브라우저에 넘기지 않는다.
      className="fixed inset-0 z-[80] flex touch-none items-center justify-center bg-navy/45 p-4"
    >
      {/* board.svg는 자체 완결형 프레임 — 별도 패널 없이 이미지만 중앙 배치.
          접근성: 이미지 컨테이너에 도감 역할을 부여(헤더 텍스트는 보드가 대체).
          현재는 정적 view-only라 보드 위 탭도 backdrop과 동일하게 닫힘 처리(위 onDown/onUp). */}
      {/* 부모 박스를 board 이미지와 '정확히 같은 크기'로 맞춘다(오버레이 %정렬의 기준).
          이미지를 in-flow(block)로 두고 max-w/max-h로 제한 → 부모(inline 크기)가 이미지에 딱 맞음.
          (이전엔 부모 폭 고정 + 이미지 max-h 축소로 크기가 어긋나 오버레이가 칸을 벗어났다.) */}
      <div role="img" aria-label="몬스터 도감" className="relative">
        {/* eslint-disable-next-line @next/next/no-img-element -- 벡터(SVG) 보드: next/image 최적화 불필요, 확대해도 선명 */}
        <img
          src={BOARD_SRC}
          alt=""
          aria-hidden="true"
          className="block h-auto max-h-[92dvh] w-auto max-w-[90vw]"
          draggable={false}
        />

        {/* 포획 몬스터 이미지 — board 칸 좌표(%)에 순서대로 얹어 "?"를 덮는다. */}
        {collection.slice(0, CELLS.length).map((entry, i) => {
          const cell = CELLS[i];
          if (!entry.imageUrl) return null; // 이미지 없으면 board의 "?" 그대로 노출
          return (
            // eslint-disable-next-line @next/next/no-img-element -- 도감 칸 몬스터 썸네일
            <img
              key={entry.monsterId}
              src={entry.imageUrl}
              alt={entry.koreanName}
              draggable={false}
              className="absolute object-contain"
              style={{
                left: `${(cell.x / BOARD_W) * 100}%`,
                top: `${(cell.y / BOARD_H) * 100}%`,
                width: `${(CELL_W / BOARD_W) * 100}%`,
                height: `${(CELL_H / BOARD_H) * 100}%`,
              }}
            />
          );
        })}
      </div>
    </div>
  );
}
