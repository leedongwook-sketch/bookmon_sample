"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { useGameStore } from "@/store/gameStore";
import { useMyPosition } from "@/features/map/useMyPosition";
import { useEncounterFlow } from "@/features/map/useEncounterFlow";
import { TestModeBanner } from "@/features/map/TestModeBanner"; // ⚠ 테스트 전용(삭제 가능)
import { computeGroundLayout } from "./layout";
import type { EventMap, Game, GroundLayout } from "@/types";

// three <Canvas>는 브라우저(WebGL) 전용 → SSR 비활성. (Next 16: ssr:false는 클라 컴포넌트에서만 허용)
const Map3DScene = dynamic(() => import("./Map3DScene").then((m) => m.Map3DScene), {
  ssr: false,
  loading: () => <MapMessage>3D 지도를 준비하는 중…</MapMessage>,
});

/**
 * 3D 지도(map3d) — 기존 2D(BM-201)와 완전히 독립된 별도 화면.
 *  - 평면 지도 이미지를 지면에 깔고 카메라(공간)만 원근 틸트. 드래그로 시점 회전(오빗).
 *  - gameStore의 몬스터/내 위치로 지면 world 좌표(GroundLayout)를 계산해 스토어에 저장 후 렌더.
 */
export function Map3DScreen() {
  const [mounted, setMounted] = useState(false);
  const eventMap = useGameStore((s) => s.eventMap);
  const games = useGameStore((s) => s.games);

  // persist 스토어는 클라이언트 전용 → 마운트 후 읽는다(2D와 동일 패턴)
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
  }, []);

  if (!mounted) return <MapMessage>지도를 불러오는 중…</MapMessage>;
  if (!eventMap)
    return <MapMessage>지도 정보가 없습니다. 시작 화면에서 다시 진입해 주세요.</MapMessage>;

  return <Map3DView eventMap={eventMap} games={games} />;
}

function Map3DView({ eventMap, games }: { eventMap: EventMap; games: Game[] }) {
  const myPos = useMyPosition();
  const setGroundLayout = useGameStore((s) => s.setGroundLayout);
  const groundLayout = useGameStore((s) => s.groundLayout);
  const collection = useGameStore((s) => s.collection);

  // 포획(퀴즈 성공→도감 추가)한 몬스터는 3D에서도 제외 — 2D 지도와 동기화(마커/조우/layout 공통).
  // useMemo: layout 계산 useEffect의 deps라 참조 안정화(games/collection 불변 시 재계산 방지).
  const activeGames = useMemo(
    () =>
      games.filter((g) => !collection.some((e) => e.monsterId === g.monster.id)),
    [games, collection]
  );

  // 조우 흐름(2D와 동일 공용 훅). 근접 판정은 GPS lat/lng만 사용 — 3D 표시좌표(world)와 무관.
  const { beginEncounter, layers: encounterLayers } = useEncounterFlow({
    games: activeGames,
    myPos,
  });

  // 지도 이미지 자연 크기(종횡비) 측정 → 지면 평면 비율 확정.
  const [natural, setNatural] = useState<{ w: number; h: number } | null>(null);

  // natural 확보 시(또는 내 위치/게임 변경 시) 지면 world 좌표 계산 → 스토어 저장.
  useEffect(() => {
    if (!natural) return;
    const layout: GroundLayout = computeGroundLayout(
      eventMap,
      activeGames,
      myPos,
      natural
    );
    setGroundLayout(layout);
  }, [natural, eventMap, activeGames, myPos, setGroundLayout]);

  // 씬 렌더 준비 — natural(로컬 측정)과 groundLayout(스토어) 둘 다 있어야 그린다.
  // 첫 진입엔 이 둘이 비동기로 채워지므로, 준비 전엔 흰 화면이 아니라 로딩 폴백을 보인다.
  return (
    <div className="relative h-[100dvh] w-full touch-none select-none overflow-hidden bg-[#e7e3d8]">
      {natural && groundLayout ? (
        <Map3DScene
          // 고정 key — 리렌더(내 위치 갱신 등)로 Canvas가 재마운트돼 WebGL 컨텍스트가
          // 새로 생성/누수되지 않게 단일 마운트를 보장한다.
          key="map3d-canvas"
          imageUrl={eventMap.imageUrl}
          layout={groundLayout}
          games={activeGames}
          // ⚠ 테스트 전용: 몬스터 클릭으로 조우 수동 트리거(2D ArTestTriggers와 동일 성격).
          onMonsterTrigger={beginEncounter}
        />
      ) : (
        // 준비 전(natural 측정/groundLayout 계산 대기) — 흰 화면 방지용 폴백.
        <div className="flex h-full w-full items-center justify-center">
          <p className="text-sm font-semibold text-navy/70">3D 지도를 불러오는 중…</p>
        </div>
      )}

      {/* ⚠ 테스트 전용: 상단 안내 배너 */}
      <TestModeBanner />

      {/* 조우 오버레이 — 배너/AR/퀴즈/도감(공용 훅). DOM 오버레이라 Canvas 위에 그대로 얹힘. */}
      {encounterLayers}

      {/* 우상단: 2D 지도로 복귀 (작은 버튼) */}
      <ModeSwitchButton />

      {/* natural size 측정용(숨김) — 항상 마운트해 종횡비를 확보한다.
          (조건부 렌더 시 natural 채워지는 순간 img가 사라져 재측정이 막히는 문제 방지) */}
      {/* eslint-disable-next-line @next/next/no-img-element -- 크기 측정 전용 */}
      <img
        src={eventMap.imageUrl}
        alt=""
        className="hidden"
        onLoad={(e) => {
          const img = e.currentTarget;
          // 이미 측정했으면 스킵 — onLoad 재발화로 setNatural이 반복돼 불필요한 리렌더가 나지 않게.
          setNatural((prev) =>
            prev ? prev : { w: img.naturalWidth, h: img.naturalHeight }
          );
        }}
      />
    </div>
  );
}

// 우상단 모드 전환 버튼 — 3D → 2D 지도.
function ModeSwitchButton() {
  return (
    <Link
      href="/map"
      className="absolute right-[max(0.75rem,var(--spacing-safe-r))] top-[max(0.75rem,var(--spacing-safe-t))] z-10 flex items-center gap-1 rounded-full border-2 border-navy bg-ivory/95 px-3 py-2 text-xs font-extrabold text-navy shadow-lg active:scale-95"
    >
      2D 지도
    </Link>
  );
}

function MapMessage({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-[100dvh] w-full items-center justify-center bg-[#e7e3d8] px-6 text-center">
      <p className="text-sm font-semibold text-navy/70">{children}</p>
    </div>
  );
}
