"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useGameStore } from "@/store/gameStore";
import { MapView } from "@/features/map/MapScreen";
import { MAP_GOLD_BUTTON } from "@/features/map/mapButtonStyle";
import { usePracticePosition } from "./usePracticePosition";
import { generateMonsterNear, refreshMonsterVisuals } from "./practiceData";
import type { EventMap, GameLocation } from "@/types";

// 실행모드 지도 화면 — 최초 GPS 픽스 기준 고정 이미지 지도(용인초 일러스트, OSM 대체).
//   · 행사모드 2D와 동일한 이미지 지도(MapView 공용, variant="practice")로 렌더한다.
//   · 앵커 합성: 최초 픽스를 이미지 중심에 두고, 이미지가 실측 약 150m(가로)×160m(세로)를
//     덮는다고 가정해 NW/SE 위경도를 계산 → projectToImage 매핑이 그대로 성립한다.
//     (앵커는 최초 픽스에 1회 고정 — 이후 이동해도 지도는 고정, 내 마커만 움직인다.)
//   · 내 위치 마커+파란 레이더, 12~20m 랜덤 몬스터 생성, 카메라 팔로우, 책 마커 클릭/10m
//     근접 조우(행사모드와 동일 훅), 포획 후 재생성 등 기존 기능은 모두 동일.
//   · 이미지 밖으로 나가면 경고 없이 마커/카메라가 가장자리에 클램프된다(MapView 처리).

// 체험모드 지도 이미지 — 용인초등학교 일러스트(900×960). /images 경로는 배포 시
// gh-pages-rewrite 가 basePath 접두.
const PRACTICE_MAP_URL = "/images/practice-map.svg";

// 이미지가 덮는 실제 영역 가정(m) — 이미지 종횡비(900:960)에 맞춘 150×160m.
// 몬스터 최대 거리 20m·도착 반경 10m 대비 충분히 넓어 마커가 화면 안에 여유 있게 찍힌다.
const SPAN_X_M = 150;
const SPAN_Y_M = 160;

// 최초 픽스(center)를 이미지 중심으로 두는 합성 EventMap.
//   위도 1도 ≈ 111,320m, 경도는 cos(위도) 보정 — 행사모드 앵커(NW=0,0 / SE=1,1)와 동일 구조.
function synthesizeEventMap(center: GameLocation): EventMap {
  const halfLat = SPAN_Y_M / 2 / 111_320;
  const halfLng =
    SPAN_X_M / 2 / (111_320 * Math.cos((center.latitude * Math.PI) / 180));
  return {
    imageUrl: PRACTICE_MAP_URL,
    anchors: [
      {
        x: 0,
        y: 0,
        latitude: center.latitude + halfLat, // NW(좌상) = 북서
        longitude: center.longitude - halfLng,
      },
      {
        x: 1,
        y: 1,
        latitude: center.latitude - halfLat, // SE(우하) = 남동
        longitude: center.longitude + halfLng,
      },
    ],
  };
}

export function PracticeMapScreen() {
  const { position, error } = usePracticePosition();
  const games = useGameStore((s) => s.games);
  const collection = useGameStore((s) => s.collection);
  const setGames = useGameStore((s) => s.setGames);
  const seqRef = useRef(0);

  // 합성 지도 원점 = 최초 GPS 픽스(1회 고정).
  const [origin, setOrigin] = useState<GameLocation | null>(null);
  useEffect(() => {
    if (!position || origin) return;
    // 최초 픽스 도착(외부 이벤트) → 원점 1회 고정(이후 불변이라 캐스케이드 없음).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setOrigin(position);
  }, [position, origin]);
  const eventMap = useMemo(
    () => (origin ? synthesizeEventMap(origin) : null),
    [origin]
  );

  // 활성 몬스터 = 아직 도감에 기록되지 않은 것(1마리씩).
  const active =
    games.find((g) => !collection.some((e) => e.monsterId === g.monster.id)) ??
    null;
  const hasFix = position !== null;

  // 픽스가 있고 활성 몬스터가 없으면 내 위치 주변에 새 몬스터 1마리 생성.
  useEffect(() => {
    if (active || !position) return;
    seqRef.current += 1;
    const monster = generateMonsterNear(position, seqRef.current);
    setGames([...useGameStore.getState().games, monster]);
    // position 최신값은 spawn 순간에만 필요 → deps 는 활성여부/픽스여부만.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, hasFix]);

  // 영속 몬스터 마이그레이션 — 이미지 교체 이전 빌드에서 생성돼 localStorage 에 남은
  // 활성 몬스터의 비주얼(썸네일·스프라이트)을 현재 테스트 리소스로 갱신한다.
  // (안 하면 조우 시 req.sprites 가 옛 경로/"" 로 나가 AR 스프라이트가 미적용된다)
  useEffect(() => {
    if (!active) return;
    const fresh = refreshMonsterVisuals(active);
    if (fresh === active) return;
    setGames(
      useGameStore.getState().games.map((g) => (g.id === fresh.id ? fresh : g))
    );
  }, [active, setGames]);

  // 첫 GPS 픽스 전/에러 안내.
  if (error) {
    return (
      <Centered>
        <p className="text-base font-bold text-navy">{error}</p>
        <HomeButton />
      </Centered>
    );
  }
  if (!position || !eventMap) {
    return (
      <Centered>
        <p className="text-base font-bold text-navy">현재 위치를 확인하는 중…</p>
        <p className="text-sm text-navy/60">위치 권한을 허용해 주세요.</p>
      </Centered>
    );
  }

  // 공용 이미지 지도(MapView) — 카메라 팔로우/드래그/마커/메뉴/조우 오버레이 모두 포함.
  //   변형점(variant="practice"): 책 마커 탭 조우 + 내 위치 클램프, 3D/경고/미니맵 없음.
  return <MapView eventMap={eventMap} games={games} myPos={position} variant="practice" />;
}

// 중앙 안내 컨테이너.
function Centered({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-[100dvh] w-full flex-col items-center justify-center gap-3 bg-[#e7e3d8] px-6 text-center">
      {children}
    </div>
  );
}

function HomeButton() {
  return (
    <Link
      href="/"
      className={`mt-1 flex items-center justify-center rounded-full px-5 py-2.5 text-sm font-bold ${MAP_GOLD_BUTTON}`}
    >
      처음으로
    </Link>
  );
}

export default PracticeMapScreen;
