"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useGameStore } from "@/store/gameStore";
import { useMyPosition } from "./useMyPosition";
import { MapMenu } from "./MapMenu";
import { TestModeBanner } from "./TestModeBanner"; // ⚠ 테스트 전용(삭제 가능)
import { useEncounterFlow } from "./useEncounterFlow";
import { ArTestTriggers } from "./ArTestTrigger"; // ⚠ 테스트 전용(삭제 가능)
import { projectToImage } from "./geo";
import type { EventMap, Game, GameLocation } from "@/types";

const ZOOM = 2.5; // 화면 확대 배율 (전체 맞춤 대비 4배)
const RETURN_DELAY_MS = 2000; // 드래그 후 내 위치로 복귀까지 대기
const FOLLOW_TRANSITION = "transform 500ms ease-out"; // 팔로우/복귀 시 부드러운 이동

type XY = { x: number; y: number };

/**
 * 지도(메인) — BM-201.
 *  - 전체화면 지도. 내 위치는 화면 중앙 고정(카메라가 나를 따라감), 4배 확대.
 *  - 드래그하면 그 영역을 보여주고, 2초간 터치가 없으면 내 위치로 되돌아온다.
 *  - 내 위치가 갱신되면(약 1초) 마킹이 다시 렌더되고 지도도 함께 움직인다.
 */
export function MapScreen() {
  const [mounted, setMounted] = useState(false);
  const eventMap = useGameStore((s) => s.eventMap);
  const games = useGameStore((s) => s.games);

  // persist 스토어는 클라이언트 전용 → 마운트 후 읽는다(의도된 패턴)
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
  }, []);

  if (!mounted) return <MapMessage>지도를 불러오는 중…</MapMessage>;
  if (!eventMap)
    return <MapMessage>지도 정보가 없습니다. 시작 화면에서 다시 진입해 주세요.</MapMessage>;

  return <MapView eventMap={eventMap} games={games} />;
}

function MapView({ eventMap, games }: { eventMap: EventMap; games: Game[] }) {
  // 이미 포획(퀴즈 성공→도감 추가)한 몬스터는 지도에서 제외 — 마커/미니맵/조우 모두 미포획만 대상.
  const collection = useGameStore((s) => s.collection);
  const activeGames = useMemo(
    () =>
      games.filter((g) => !collection.some((e) => e.monsterId === g.monster.id)),
    [games, collection]
  );
  const containerRef = useRef<HTMLDivElement>(null);
  const myPos = useMyPosition();

  // 뷰포트/이미지 자연 크기
  const [viewport, setViewport] = useState<{ w: number; h: number }>({ w: 0, h: 0 });
  const [natural, setNatural] = useState<{ w: number; h: number } | null>(null);

  // 카메라: freeCenter=null이면 내 위치 팔로우, 값이 있으면 드래그로 본 자유 영역
  const [freeCenter, setFreeCenter] = useState<XY | null>(null);
  const [dragging, setDragging] = useState(false);
  const dragStart = useRef<{ px: number; py: number; center: XY } | null>(null);
  const returnTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 컨테이너 실제 크기 추적
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const measure = () => setViewport({ w: el.clientWidth, h: el.clientHeight });
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    measure();
    return () => ro.disconnect();
  }, []);

  useEffect(() => () => {
    if (returnTimer.current) clearTimeout(returnTimer.current);
  }, []);

  const ready = !!natural && viewport.w > 0 && viewport.h > 0;

  // 표시 배율/크기 — 전체 맞춤(fit) × ZOOM
  const fitScale = natural
    ? Math.min(viewport.w / natural.w, viewport.h / natural.h)
    : 1;
  const displayScale = fitScale * ZOOM;
  const mapW = natural ? natural.w * displayScale : 0;
  const mapH = natural ? natural.h * displayScale : 0;

  // 내 위치 → 이미지 비율. 카메라 중심 = 자유영역 or 내 위치.
  const meRatio = project(eventMap, myPos);
  const center = freeCenter ?? meRatio;

  // ── AR 조우 흐름 (공용 훅) ─────────────────────────────
  // 도착(반경 10m 진입)/테스트 클릭 → '몬스터 발견' 배너 → AR → 퀴즈 → 도감.
  // 상태머신·근접판정·오버레이 레이어는 useEncounterFlow(2D·3D 공용)로 추출됨.
  const { beginEncounter, layers: encounterLayers } = useEncounterFlow({
    games: activeGames,
    myPos,
  });

  // 지도 레이어 이동량: 카메라 중심을 화면 중앙에 오게 한다.
  const tx = viewport.w / 2 - center.x * mapW;
  const ty = viewport.h / 2 - center.y * mapH;

  // ── 드래그(자유 이동) ─────────────────────────────
  const onPointerDown = (e: React.PointerEvent) => {
    if (!ready) return;
    if (returnTimer.current) clearTimeout(returnTimer.current);
    e.currentTarget.setPointerCapture?.(e.pointerId);
    dragStart.current = { px: e.clientX, py: e.clientY, center };
    setDragging(true);
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!dragging || !dragStart.current || !mapW || !mapH) return;
    const { px, py, center: start } = dragStart.current;
    // 손가락을 따라 지도가 움직이도록 카메라 중심은 반대로 이동
    const nx = clamp01(start.x - (e.clientX - px) / mapW);
    const ny = clamp01(start.y - (e.clientY - py) / mapH);
    setFreeCenter({ x: nx, y: ny });
  };

  const endDrag = (e: React.PointerEvent) => {
    if (!dragging) return;
    e.currentTarget.releasePointerCapture?.(e.pointerId);
    dragStart.current = null;
    setDragging(false);
    // 2초간 터치 없으면 내 위치로 복귀
    returnTimer.current = setTimeout(() => setFreeCenter(null), RETURN_DELAY_MS);
  };

  return (
    <div
      ref={containerRef}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      className="relative h-[100dvh] w-full touch-none select-none overflow-hidden bg-[#e7e3d8]"
    >
      {ready && (
        <div
          className="absolute left-0 top-0 origin-top-left will-change-transform"
          style={{
            width: mapW,
            height: mapH,
            transform: `translate(${tx}px, ${ty}px)`,
            transition: dragging ? "none" : FOLLOW_TRANSITION,
          }}
        >
          {/* 배경 지도 이미지 */}
          {/* eslint-disable-next-line @next/next/no-img-element -- 변환(scale/translate) 캔버스라 naturalSize 접근을 위해 plain img 사용 */}
          <img
            src={eventMap.imageUrl}
            alt="행사장 지도"
            className="h-full w-full"
            draggable={false}
          />

          {/* 몬스터 마킹 */}
          {activeGames.map((game) => (
            <MonsterMarker key={game.id} game={game} eventMap={eventMap} />
          ))}

          {/* 내 위치 마킹 */}
          <MyMarker ratio={meRatio} />

          {/* ⚠ 테스트 전용: 마커 클릭으로 AR 조우 수동 트리거. 이 한 줄 + ArTestTrigger.tsx만 지우면 제거됨. */}
          <ArTestTriggers games={activeGames} eventMap={eventMap} onTrigger={beginEncounter} />
        </div>
      )}

      {/* ⚠ 테스트 전용: 상단 안내 배너 */}
      <TestModeBanner />

      {/* 공통 메뉴 — 왼쪽 위 햄버거 (도감 / 초기화) */}
      <MapMenu />

      {/* 우상단: 3D 지도로 이동 (작은 버튼) */}
      <Link
        href="/map3d"
        onPointerDown={(e) => e.stopPropagation()} // 지도 드래그로 번지지 않게
        className="absolute right-[max(0.75rem,var(--spacing-safe-r))] top-[max(0.75rem,var(--spacing-safe-t))] z-10 flex items-center gap-1 rounded-full border-2 border-navy bg-ivory/95 px-3 py-2 text-xs font-extrabold text-navy shadow-lg active:scale-95"
      >
        3D 지도
      </Link>

      {/* 조우 오버레이 — 배너/AR/퀴즈/도감 (공용 훅에서 렌더). DOM 오버레이라 지도 위에 얹힘. */}
      {encounterLayers}

      {/* 미니맵 — 오른쪽 아래 고정. 지도 이미지 비율 박스에 몬스터/내 위치를 점으로 표시. */}
      {ready && natural && (
        <MiniMap
          imageUrl={eventMap.imageUrl}
          aspect={`${natural.w} / ${natural.h}`}
          dots={activeGames.map((g) => ({ id: g.id, ...project(eventMap, g.location) }))}
          me={meRatio}
        />
      )}

      {/* natural size 측정용(숨김). 로드되면 자연 크기 확보 → 위 레이어 렌더 */}
      {!natural && (
        // eslint-disable-next-line @next/next/no-img-element -- 크기 측정 전용
        <img
          src={eventMap.imageUrl}
          alt=""
          className="hidden"
          onLoad={(e) => {
            const img = e.currentTarget;
            setNatural({ w: img.naturalWidth, h: img.naturalHeight });
          }}
        />
      )}
    </div>
  );
}

function project(eventMap: EventMap, loc: GameLocation): XY {
  return projectToImage(eventMap.anchors, loc.latitude, loc.longitude);
}

function clamp01(v: number): number {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

// 몬스터 1마리를 좌표 비율 위치에 마킹 (원 중심 = 좌표).
function MonsterMarker({ game, eventMap }: { game: Game; eventMap: EventMap }) {
  const { x, y } = project(eventMap, game.location);
  // 텍스트 요소 없이 노란 원만 표시. (몬스터명은 접근성용 aria-label로만 유지)
  return (
    <div
      role="img"
      aria-label={game.monster.koreanName}
      className="absolute h-9 w-9 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-navy bg-gold shadow-md"
      style={{ left: `${x * 100}%`, top: `${y * 100}%` }}
    />
  );
}

// 내 위치 마킹 — 스카이블루 점 + 흰 링 + 맥동.
function MyMarker({ ratio }: { ratio: XY }) {
  return (
    <div
      className="absolute -translate-x-1/2 -translate-y-1/2"
      style={{ left: `${ratio.x * 100}%`, top: `${ratio.y * 100}%` }}
    >
      <span className="absolute left-1/2 top-1/2 h-10 w-10 -translate-x-1/2 -translate-y-1/2 animate-ping rounded-full bg-skyblue/40" />
      <span className="relative block h-5 w-5 rounded-full border-[3px] border-white bg-skyblue shadow-[0_0_0_2px_rgba(1,156,244,0.5)]" />
    </div>
  );
}

// 미니맵 — 지도 이미지 비율의 작은 박스. 몬스터=골드 점, 내 위치=스카이블루 점.
function MiniMap({
  imageUrl,
  aspect,
  dots,
  me,
}: {
  imageUrl: string;
  aspect: string;
  dots: { id: string; x: number; y: number }[];
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

      {/* 몬스터 점 */}
      {dots.map((d) => (
        <span
          key={d.id}
          className="absolute h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full border border-navy bg-gold"
          style={{ left: `${d.x * 100}%`, top: `${d.y * 100}%` }}
        />
      ))}

      {/* 내 위치 점 */}
      <span
        className="absolute h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full border border-white bg-skyblue"
        style={{ left: `${me.x * 100}%`, top: `${me.y * 100}%` }}
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
