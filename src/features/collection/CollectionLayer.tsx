"use client";

import { useRef } from "react";
import { useGameStore } from "@/store/gameStore";
import type { CollectionEntry, Monster } from "@/types";

// 탭으로 인정할 최대 이동 거리(px). 이보다 크게 움직이면 드래그/스크롤로 보고 닫지 않는다.
const TAP_SLOP_PX = 10;

/**
 * 몬스터 도감 레이어 — 지도 위 오버레이 (피그마 비율 재현, CSS + 반응형).
 *  패널 3레이어: 네이비 베이스(#124889) + 블루 프레임(#366AB4) + 흰→#DDDDDD 내부.
 *  칸 3상태(CollectionEntry.acquired 기준):
 *    - 미획득(엔트리 없음): 크림 #FFF3DA + 파란 테두리 #366AB4 + "?"
 *    - 포획(acquired=true): gradient #30BDFF→#366AB4 + 테두리 #0055CE + 몬스터 이미지
 *    - 포획실패(acquired=false): #656565 + 가운데 빨간 X
 *  로스터 = 모둠 게임(games)의 유니크 몬스터. 항상 5열×4행=20칸(넘치면 행 확장).
 *
 * 크기: 반응형 폭 min(가로, 세로환산). 패딩/갭은 %로 두어 어떤 크기에서도 **비율 동일**.
 *   (이전 FitToViewport 방식은 콘텐츠를 키우면 오히려 더 축소돼 갭이 좁아지는 문제가 있어 교체.)
 *
 * 닫기: 레이어 아무 곳이나 탭(정적 view-only). pointerdown→up 이동량이 작을 때만 닫음.
 */
export function CollectionLayer({ onClose }: { onClose: () => void }) {
  const games = useGameStore((s) => s.games);
  const collection = useGameStore((s) => s.collection);

  // 유니크 몬스터 로스터(게임 순서 유지, 중복 monster.id 제거).
  const seen = new Set<string>();
  const roster: Monster[] = [];
  for (const g of games) {
    if (!seen.has(g.monster.id)) {
      seen.add(g.monster.id);
      roster.push(g.monster);
    }
  }
  // 전체 칸 수 = 총 몬스터(로스터) 기준, 항상 5×4=20칸 최소. 20 초과면 5열 기준 행 확장.
  const cellCount = Math.max(20, Math.ceil(roster.length / 5) * 5);

  // pointerdown 시작점 — pointerup에서 이동량이 작으면(탭) 닫는다.
  const downRef = useRef<{ x: number; y: number } | null>(null);
  const onDown = (e: React.PointerEvent) => {
    e.stopPropagation(); // 뒤 지도 드래그 방지
    downRef.current = { x: e.clientX, y: e.clientY };
  };
  const onUp = (e: React.PointerEvent) => {
    const start = downRef.current;
    downRef.current = null;
    if (!start) return;
    if (Math.hypot(e.clientX - start.x, e.clientY - start.y) <= TAP_SLOP_PX) {
      onClose();
    }
  };

  return (
    <div
      onPointerDown={onDown}
      onPointerUp={onUp}
      className="fixed inset-0 z-[80] flex touch-none items-center justify-center bg-navy/45 p-3"
    >
      {/* 반응형 폭 + 컨테이너 쿼리 기준. 내부 치수는 전부 cqw(=컨테이너폭 1%)로 →
          가로/세로 갭이 동일 px, 어떤 크기에서도 비율 동일, 부모를 벗어나지 않는다.
          (일반 % gap 은 세로(row-gap)가 auto 높이에서 0 처리되는 문제가 있어 cqw 로 교체.) */}
      <div className="@container w-[min(80vw,100dvh,780px)]">
        {/* 네이비 베이스(하단 림) + 블루 프레임(#366AB4) + 드롭섀도. */}
        <div
          role="img"
          aria-label="몬스터 도감"
          className="rounded-[4cqw] bg-[#366ab4] p-[2cqw] shadow-[0_10px_0_#124889,-5px_6px_12px_rgba(0,0,0,0.5)]"
        >
          {/* 내부 패널: 흰→#DDDDDD 그라데. */}
          <div className="rounded-[3cqw] bg-gradient-to-b from-white to-[#dddddd] p-[3.5cqw]">
            {/* 5열 그리드 — 갭 2.6cqw. 시도 순서(collection)대로 좌상단부터 채우고 나머지는 "?". */}
            <div className="grid grid-cols-5 gap-[2.6cqw]">
              {Array.from({ length: cellCount }, (_, i) => {
                const entry = collection[i]; // 시도한 순서대로 앞칸부터
                return (
                  <DexCell key={entry?.monsterId ?? `empty-${i}`} entry={entry} />
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// 도감 칸 — 정사각(aspect-square, 폭에 맞춰 크기 결정). radius/border 는 칸 크기에 비례(% 근사).
function DexCell({ entry }: { entry?: CollectionEntry }) {
  // 컨테이너폭 기준(cqw): 칸 ≈ 15cqw. radius/칸≈0.2→3cqw, border/칸≈0.048→0.7cqw.
  const base =
    "flex aspect-square w-full items-center justify-center rounded-[3cqw] border-[0.7cqw]";

  // 포획실패: 실패 이미지(회색 몬스터 + 빨간 X, 파란 테두리 baked). 이미지 자체가 칸을 채운다.
  if (entry && !entry.acquired) {
    return (
      <div className="aspect-square w-full overflow-hidden rounded-[3cqw]">
        {/* eslint-disable-next-line @next/next/no-img-element -- 도감 포획실패 칸 이미지 */}
        <img
          src="/images/collect/non_catch_mon.png"
          alt={`${entry.koreanName} 포획 실패`}
          draggable={false}
          className="h-full w-full object-cover"
        />
      </div>
    );
  }

  // 포획 성공: 성공 이미지(몬스터 + 파란 테두리 baked). 실패 칸과 대칭 구조.
  //   ⚠ [테스트] 지금은 고정 이미지. 실서버 몬스터 썸네일 연동 시 entry.imageUrl 을 프레임 안에 합성.
  if (entry?.acquired) {
    return (
      <div className="aspect-square w-full overflow-hidden rounded-[3cqw]">
        {/* eslint-disable-next-line @next/next/no-img-element -- 도감 포획성공 칸 이미지 */}
        <img
          src="/images/collect/catch_mon.png"
          alt={`${entry.koreanName} 포획 성공`}
          draggable={false}
          className="h-full w-full object-cover"
        />
      </div>
    );
  }

  // 미획득: 크림 + 파란 테두리 + "?"
  return (
    <div className={`${base} border-[#366ab4] bg-[#fff3da]`}>
      <span className="text-[7cqw] font-extrabold leading-none text-[#12213a]">
        ?
      </span>
    </div>
  );
}
