"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useGameStore } from "@/store/gameStore";
import { useMyPosition, useCompassHeading } from "./useMyPosition";
import { useEncounterFlow } from "./useEncounterFlow";
import { projectToImage, isWithinEventBounds } from "./geo";
import { MapHud, type ModeSwitch } from "./MapHud";
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
  const myPos = useMyPosition();

  // persist 스토어는 클라이언트 전용 → 마운트 후 읽는다(의도된 패턴)
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
  }, []);

  if (!mounted) return <MapMessage>지도를 불러오는 중…</MapMessage>;
  if (!eventMap)
    return <MapMessage>지도 정보가 없습니다. 시작 화면에서 다시 진입해 주세요.</MapMessage>;

  return <MapView eventMap={eventMap} games={games} myPos={myPos} />;
}

/**
 * 이미지 지도 뷰 — 행사모드(2D)와 체험모드가 공유한다. 오버레이 UI 는 공통 HUD(MapHud).
 *  - myPos 는 소스 무관(행사=useMyPosition, 체험=usePracticePosition 픽스)하게 prop 으로 받는다.
 *  - variant:
 *      "event"    = 행사모드 기본. HUD 에 3D 전환 버튼/이탈 경고 포함.
 *      "practice" = 체험모드. 3D 전환·경고 없음(도감/미니맵은 동일) + 책 마커 탭으로 조우
 *                   시작(수동 트리거) + 내 위치가 이미지 밖이면 가장자리에 클램프.
 */
export function MapView({
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
  // 2D↔3D 전환 — 미전달 시 행사=/map3d 라우트, 체험=숨김(기본). 체험모드는 로컬 토글 콜백을 넘긴다.
  modeSwitch?: ModeSwitch;
}) {
  // 순차 진행: 아직 시도하지 않은(collection 미기록) 몬스터 중 **첫 1개만** 지도에 표시.
  //   → 마커·미니맵·조우 모두 이 activeGames 를 공유하므로 한 번에 한 마리씩만 노출된다.
  //   (성공/실패 무관하게 collection 에 기록되면 다음 몬스터로 넘어간다.)
  const collection = useGameStore((s) => s.collection);
  const activeGames = useMemo(() => {
    const next = games.find(
      (g) => !collection.some((e) => e.monsterId === g.monster.id)
    );
    return next ? [next] : [];
  }, [games, collection]);
  const containerRef = useRef<HTMLDivElement>(null);
  const isPractice = variant === "practice";

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
  //   체험모드는 이미지 밖으로 나가도 경고 대신 마커/카메라를 가장자리에 클램프.
  const meProj = project(eventMap, myPos);
  const meRatio = isPractice
    ? { x: clampInset(meProj.x), y: clampInset(meProj.y) }
    : meProj;
  const center = freeCenter ?? meRatio;

  // 내 위치가 행사장 bbox 밖이면 전체화면 레드 경고(행사모드 전용).
  const outOfBounds =
    !isPractice &&
    !isWithinEventBounds(eventMap.anchors, myPos.latitude, myPos.longitude);

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

          {/* 몬스터 마킹 — 체험모드는 탭으로도 조우 시작(테스트/수동 트리거) */}
          {activeGames.map((game) => (
            <MonsterMarker
              key={game.id}
              game={game}
              eventMap={eventMap}
              onTap={isPractice ? () => beginEncounter(game) : undefined}
            />
          ))}

          {/* 내 위치 마킹 */}
          <MyMarker ratio={meRatio} />
        </div>
      )}

      {/* 공통 HUD — 좌상단 도감 / 우상단 2D↔3D 전환(행사 전용) / 우하단 미니맵 / 이탈 경고.
          3화면(2D 행사·3D 행사·체험) 공용 레이어(MapHud). */}
      <MapHud
        modeSwitch={
          modeSwitch ??
          (isPractice ? undefined : { href: "/map3d", label: "3D 지도" })
        }
        miniMap={
          ready && natural
            ? {
                imageUrl: eventMap.imageUrl,
                aspect: `${natural.w} / ${natural.h}`,
                me: meRatio,
              }
            : undefined
        }
        outOfBounds={outOfBounds}
      />

      {/* 조우 오버레이 — 흰 전환/기기안내/퀴즈/도감 (공용 훅에서 렌더). AR은 /ar/shooting/ 전체 이동.
          DOM 오버레이라 지도 위에 얹힘. */}
      {encounterLayers}

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

// 마커가 지도 이미지 가장자리에서 잘리지 않게 살짝 안쪽(2%~98%)으로 클램프.
function clampInset(v: number, inset = 0.02): number {
  const lo = inset,
    hi = 1 - inset;
  return v < lo ? lo : v > hi ? hi : v;
}

// 몬스터 1마리를 좌표 비율 위치에 마킹 (책 마커 중심 = 좌표).
//   onTap(체험모드): 책 마커 탭 → 조우 시작. 지도 드래그로 번지지 않게 pointerdown 전파 차단.
function MonsterMarker({
  game,
  eventMap,
  onTap,
}: {
  game: Game;
  eventMap: EventMap;
  onTap?: () => void;
}) {
  const p = project(eventMap, game.location);
  // 좌표가 지도 이미지(부지 bbox) 밖이어도 마커가 이미지 안에 머물도록 0~1 로 클램프.
  //   가장자리에서 마커가 반쯤 잘리지 않게 살짝 안쪽(2%~98%)으로 제한.
  const x = clampInset(p.x);
  const y = clampInset(p.y);
  // 책 마커(mk_book.png — MK_BOOK.glb 3D 모델 스냅샷) + 위아래 둥둥 애니메이션.
  // 몬스터명은 접근성용 aria-label.
  //  - 바깥 div: 좌표 위치 + 중앙정렬(translate). 안쪽 div: float 애니메이션(translate 충돌 방지).
  return (
    <div
      className="absolute -translate-x-1/2 -translate-y-1/2"
      style={{ left: `${x * 100}%`, top: `${y * 100}%` }}
      onPointerDown={onTap ? (e) => e.stopPropagation() : undefined}
      onClick={onTap}
    >
      <div
        role="img"
        aria-label={game.monster.koreanName}
        className="h-16 w-[60px] animate-[marker-float_2.2s_ease-in-out_infinite] drop-shadow-md"
        style={{
          backgroundImage: "url(/images/mk_book.png)",
          backgroundSize: "contain",
          backgroundRepeat: "no-repeat",
          backgroundPosition: "center",
        }}
      />
    </div>
  );
}

// 내 위치 마킹 — 파란 레이더 번짐(맥동) + 내비게이션 화살표 마커 이미지(mk_player.png).
//   화살표(위=진행방향)는 나침반 헤딩에 맞춰 회전(북=0). 헤딩이 없으면(데스크톱 등) 회전 없음.
function MyMarker({ ratio }: { ratio: XY }) {
  const heading = useCompassHeading();
  return (
    <div
      // GPS 갱신이 띄엄띄엄이라 left/top 이 순간이동하지 않게 부드럽게 전환(카메라 팔로우와 맞춤).
      className="absolute -translate-x-1/2 -translate-y-1/2 transition-[left,top] duration-500 ease-out"
      style={{ left: `${ratio.x * 100}%`, top: `${ratio.y * 100}%` }}
    >
      {/* 파란 레이더 번짐 — 중심에서 퍼지며 사라짐(마커 뒤) */}
      <span className="absolute left-1/2 top-1/2 h-14 w-14 -translate-x-1/2 -translate-y-1/2 animate-ping rounded-full bg-skyblue/40" />
      {/* eslint-disable-next-line @next/next/no-img-element -- 지도 마커: next/image 불필요, 소형 정적 마커 */}
      <img
        src="/images/mk_player.png"
        alt="내 위치"
        className="relative block h-11 w-11"
        draggable={false}
        // 헤딩은 연속각(unwrap) — 359↔0 경계에서 한 바퀴 돌지 않고 전환으로 부드럽게 따라간다.
        style={
          heading !== null
            ? {
                transform: `rotate(${heading}deg)`,
                transition: "transform 300ms ease-out",
                willChange: "transform",
              }
            : undefined
        }
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
