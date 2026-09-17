"use client";

import { useState } from "react";
import Link from "next/link";
import { CollectionLayer } from "@/features/collection/CollectionLayer";
import { OutOfBoundsWarning } from "./OutOfBoundsWarning";
import { MAP_GOLD_BUTTON } from "./mapButtonStyle";

// 지도 공통 HUD — 2D 행사 / 3D 행사 / 체험 세 지도 화면이 **동일하게** 쓰는 오버레이 UI.
// 렌더러(2D 이미지 지도 vs 3D three 지도)만 다르고 UI 레이어는 이 컴포넌트 하나를 공유한다.
//   - 좌상단: 몬스터 도감 버튼(공통) → CollectionLayer 오버레이
//   - 우상단: 2D↔3D 전환 버튼(행사모드 전용 — modeSwitch 전달 시에만)
//   - 우하단: 미니맵(공통 — miniMap 전달 시. 지도 이미지 준비 후 렌더)
//   - 위치 이탈 경고(행사모드 전용 — outOfBounds=true 일 때)
// ※ 조우 오버레이(useEncounterFlow.layers)는 상태머신과 묶여 있어 화면별로 렌더한다.

type XY = { x: number; y: number };

export function MapHud({
  modeSwitch,
  miniMap,
  outOfBounds = false,
}: {
  modeSwitch?: { href: string; label: string }; // 행사모드 전용 2D↔3D 전환(체험은 미전달)
  miniMap?: { imageUrl: string; aspect: string; me: XY }; // 준비 전(natural 측정 중)엔 미전달
  outOfBounds?: boolean; // 행사장 bbox 이탈 경고(행사모드 전용)
}) {
  const [showCollection, setShowCollection] = useState(false);

  // 2D 지도 드래그로 이벤트가 번지지 않도록 HUD 는 pointerdown 전파를 막는다(3D 에선 무해).
  const stop = (e: React.PointerEvent) => e.stopPropagation();

  return (
    <>
      {/* 좌상단: 몬스터 도감 — 우상단 전환 버튼과 동일 스타일로 통일 */}
      <button
        type="button"
        onPointerDown={stop}
        onClick={() => setShowCollection(true)}
        className={`absolute left-[max(0.75rem,var(--spacing-safe-l))] top-[max(0.75rem,var(--spacing-safe-t))] z-10 flex items-center gap-1 rounded-full px-4 py-2.5 text-sm font-extrabold ${MAP_GOLD_BUTTON}`}
        // minHeight:0 인라인 강제 — 전역 button{min-height:48px}(globals.css, unlayered)이
        // 우상단 Link 버튼과 높이를 어긋나게 해서.
        style={{ minHeight: 0 }}
      >
        도감
      </button>

      {/* 우상단: 2D↔3D 전환 (행사모드 전용) */}
      {modeSwitch && (
        <Link
          href={modeSwitch.href}
          onPointerDown={stop}
          className={`absolute right-[max(0.75rem,var(--spacing-safe-r))] top-[max(0.75rem,var(--spacing-safe-t))] z-10 flex items-center gap-1 rounded-full px-4 py-2.5 text-sm font-extrabold ${MAP_GOLD_BUTTON}`}
        >
          {modeSwitch.label}
        </Link>
      )}

      {/* 위치 이탈 경고 — 내 위치가 행사장 구역 밖이면 전체화면 레드 깜빡임(행사모드 전용). */}
      {outOfBounds && <OutOfBoundsWarning />}

      {/* 미니맵 — 오른쪽 아래 고정. 지도 이미지 비율 박스에 내 위치를 점으로 표시. */}
      {miniMap && (
        <MiniMap
          imageUrl={miniMap.imageUrl}
          aspect={miniMap.aspect}
          me={miniMap.me}
        />
      )}

      {/* 몬스터 도감 오버레이 (모듈 재사용) */}
      {showCollection && (
        <CollectionLayer onClose={() => setShowCollection(false)} />
      )}
    </>
  );
}

// 미니맵 — 지도 이미지 비율의 작은 박스. 내 위치=스카이블루 점.
function MiniMap({
  imageUrl,
  aspect,
  me,
}: {
  imageUrl: string;
  aspect: string;
  me: XY;
}) {
  return (
    <div
      // 미니맵 위 터치가 지도 드래그로 번지지 않게 차단
      onPointerDown={(e) => e.stopPropagation()}
      className="absolute bottom-[max(0.75rem,var(--spacing-safe-b))] right-[max(0.75rem,var(--spacing-safe-r))] w-[22vw] min-w-[92px] max-w-[150px] overflow-hidden rounded-lg border-2 border-navy bg-ivory/90 shadow-lg"
      style={{ aspectRatio: aspect }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element -- 미니맵 배경(비율 고정 박스) */}
      <img src={imageUrl} alt="" className="h-full w-full opacity-70" draggable={false} />

      {/* 내 위치 점 */}
      <span
        className="absolute h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full border border-white bg-skyblue"
        style={{ left: `${me.x * 100}%`, top: `${me.y * 100}%` }}
      />
    </div>
  );
}
