"use client";

import { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { useGameStore } from "@/store/gameStore";
import { useMyPosition, useCompassHeading } from "@/features/map/useMyPosition";
import { useEncounterFlow } from "@/features/map/useEncounterFlow";
import { isWithinEventBounds } from "@/features/map/geo";
import { MapHud, type ModeSwitch } from "@/features/map/MapHud";
import { computeGroundLayout } from "./layout";
import type { EventMap, Game, GameLocation, GroundLayout } from "@/types";

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
  const myPos = useMyPosition(); // 행사모드 실시간 GPS(체험모드는 usePracticePosition 픽스를 prop 주입)

  // persist 스토어는 클라이언트 전용 → 마운트 후 읽는다(2D와 동일 패턴)
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
  }, []);

  if (!mounted) return <MapMessage>지도를 불러오는 중…</MapMessage>;
  if (!eventMap)
    return <MapMessage>지도 정보가 없습니다. 시작 화면에서 다시 진입해 주세요.</MapMessage>;

  return <Map3DView eventMap={eventMap} games={games} myPos={myPos} />;
}

/**
 * 3D 지도 뷰 — 행사모드(/map3d)와 체험모드(/play)가 **공유**한다. 2D의 MapView와 동일한 계약:
 *  - myPos 는 소스 무관(행사=useMyPosition, 체험=usePracticePosition 픽스)하게 prop 으로 받는다.
 *  - variant:
 *      "event"    = 행사모드. 이탈 경고 O, 마커 탭 조우 X(GPS 근접만).
 *      "practice" = 체험모드. 이탈 경고 X, 책 마커 탭으로 조우 시작(수동 트리거).
 *  - modeSwitch: 2D↔3D 전환(행사=/map 라우트, 체험=로컬 토글 콜백). HUD 우상단 버튼.
 * 오버레이 UI 는 2D·3D·체험 공통 HUD(MapHud) 하나를 쓴다.
 */
export function Map3DView({
  eventMap,
  games,
  myPos,
  variant = "event",
  modeSwitch,
}: {
  eventMap: EventMap;
  games: Game[];
  myPos: GameLocation;
  variant?: "event" | "practice";
  modeSwitch?: ModeSwitch;
}) {
  const isPractice = variant === "practice";
  // 나침반 헤딩(연속각) — 이제 '지도 회전'이 아니라 '내 위치 화살표 방향'에만 쓴다.
  //   Scene 내부에서 지도(course-up)는 heading={null} 로 고정하고, 화살표(MyMarker)만 heading 으로 회전.
  //   → 휴대폰 방향으로 지도가 도는 기능은 제거된 상태이고, 화살표만 방향을 가리킨다.
  const heading = useCompassHeading();
  const setGroundLayout = useGameStore((s) => s.setGroundLayout);
  const groundLayout = useGameStore((s) => s.groundLayout);
  const collection = useGameStore((s) => s.collection);

  // 하늘 배경은 이제 지평선 파노라마(3D fog + 서라운드 지면 + CSS 그라데)라, 지도가 회전해도
  //   좌우 방향에 관계없이 동일(수평 균일)해 별도 패닝이 필요 없다(구름 패닝 로직 제거).

  // 순차 진행(2D와 동일): 미시도(collection 미기록) 몬스터 중 **첫 1개만** 표시.
  //   마커/조우/layout 공통이라 3D도 한 번에 한 마리씩만 노출된다.
  // useMemo: layout 계산 useEffect의 deps라 참조 안정화(games/collection 불변 시 재계산 방지).
  const activeGames = useMemo(() => {
    const next = games.find(
      (g) => !collection.some((e) => e.monsterId === g.monster.id)
    );
    return next ? [next] : [];
  }, [games, collection]);

  // 조우 흐름(2D와 동일 공용 훅). 근접 판정은 GPS lat/lng만 사용 — 3D 표시좌표(world)와 무관.
  //   체험모드는 책 마커 탭으로도 조우 시작(수동 트리거) → beginEncounter 를 씬에 전달.
  const { beginEncounter, layers: encounterLayers } = useEncounterFlow({
    games: activeGames,
    myPos,
  });

  // 내 위치가 행사장 bbox 밖이면 전체화면 레드 경고(행사모드 전용 — 체험은 합성 앵커라 경고 없음).
  const outOfBounds =
    !isPractice &&
    !isWithinEventBounds(eventMap.anchors, myPos.latitude, myPos.longitude);

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
    <div className="relative isolate h-[100dvh] w-full touch-none select-none overflow-hidden bg-[#e8f4ff]">
      {/* 하늘 배경(지평선 파노라마) — Canvas 는 투명이라 지도 평면 주변에 비친다(지도 뒤 -z-10).
          위=파란 하늘 → 아래로 갈수록 옅은 안개(베이지)로 그라데. 하단 안개색(#e8ddc5)은
          Map3DScene 의 fog(HAZE)와 동일 → 3D 지평선과 자연스럽게 이어진다. */}
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
        {/* 하늘 그라데 */}
        <div
          className="absolute inset-0"
          style={{
            background:
              "linear-gradient(180deg, #5bb3ec 0%, #86cbf0 34%, #c3e2ec 60%, #e8ddc5 82%, #e8ddc5 100%)",
          }}
        />
        {/* 구름 — 하늘(지평선 위) 상단 영역에만 떠서 천천히 흐른다. 지평선(화면 ~33%) 위쪽에 배치.
            cloud-drift 키프레임이 background-position(x=--cloud-span 이동, y=--cloud-y)을 애니메이션. */}
        <div
          className="absolute inset-x-0 top-0 h-[24%] animate-[cloud-drift_80s_linear_infinite]"
          style={{
            backgroundImage: "url(/images/clouds-strip.png)",
            backgroundRepeat: "repeat-x",
            backgroundSize: "300px 92px",
            opacity: 0.72,
            ["--cloud-span" as string]: "300px",
            ["--cloud-y" as string]: "20%",
          }}
        />
      </div>
      {natural && groundLayout ? (
        <Map3DScene
          // 고정 key — 리렌더(내 위치 갱신 등)로 Canvas가 재마운트돼 WebGL 컨텍스트가
          // 새로 생성/누수되지 않게 단일 마운트를 보장한다.
          key="map3d-canvas"
          imageUrl={eventMap.imageUrl}
          layout={groundLayout}
          games={activeGames}
          heading={heading}
          // 체험모드: 책 3D 모델 탭 → 조우 시작(수동 트리거). 행사모드는 미전달(GPS 근접만).
          onMonsterTrigger={isPractice ? beginEncounter : undefined}
        />
      ) : (
        // 준비 전(natural 측정/groundLayout 계산 대기) — 흰 화면 방지용 폴백.
        <div className="flex h-full w-full items-center justify-center">
          <p className="text-sm font-semibold text-navy/70">3D 지도를 불러오는 중…</p>
        </div>
      )}

      {/* 공통 HUD — 좌상단 도감 / 우상단 2D 전환 / 우하단 미니맵 / 이탈 경고.
          2D와 동일 레이어(MapHud). 미니맵 내 위치는 groundLayout.me 의 이미지 비율(x,y) 재사용. */}
      <MapHud
        modeSwitch={modeSwitch ?? { href: "/map", label: "2D 지도" }}
        miniMap={
          natural && groundLayout
            ? {
                imageUrl: eventMap.imageUrl,
                aspect: `${natural.w} / ${natural.h}`,
                me: { x: groundLayout.me.x, y: groundLayout.me.y },
              }
            : undefined
        }
        outOfBounds={outOfBounds}
      />

      {/* 조우 오버레이 — 흰 전환/기기안내/퀴즈/도감(공용 훅). AR은 /ar/shooting/ 전체 이동.
          DOM 오버레이라 Canvas 위에 그대로 얹힘. */}
      {encounterLayers}

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

function MapMessage({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-[100dvh] w-full items-center justify-center bg-[#e7e3d8] px-6 text-center">
      <p className="text-sm font-semibold text-navy/70">{children}</p>
    </div>
  );
}
