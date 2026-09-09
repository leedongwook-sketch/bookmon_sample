"use client";

import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { MapContainer, TileLayer, Marker, useMap } from "react-leaflet";
import { useEffect, useRef } from "react";
import Link from "next/link";
import { useGameStore } from "@/store/gameStore";
import { useEncounterFlow } from "@/features/map/useEncounterFlow";
import { MapMenu } from "@/features/map/MapMenu";
import { MAP_GOLD_BUTTON } from "@/features/map/mapButtonStyle";
import { usePracticePosition } from "./usePracticePosition";
import { generateMonsterNear } from "./practiceData";
import type { GameLocation } from "@/types";

// 실행모드 지도 화면 — 현재 위치 기준 OSM 실지도(Leaflet).
//   · 내 위치 마커: 실시간 GPS(watchPosition)로 이동. 카메라가 나를 따라간다.
//   · 몬스터: 내 위치 주변(15~35m)에 랜덤 1마리 생성 → 10m 근접 시 조우(행사모드와 동일 훅).
//     처리(성공/실패, 도감 기록)되면 다음 몬스터를 다시 주변에 생성.
//   ⚠ Leaflet 은 window 필요 → 이 컴포넌트는 /play 페이지에서 dynamic(ssr:false)로 로드된다.

// 마커 아이콘(공용 이미지). /images 경로는 배포 시 gh-pages-rewrite 가 basePath 접두.
const ME_ICON = L.icon({
  iconUrl: "/images/mk_player.png",
  iconSize: [44, 46],
  iconAnchor: [22, 23],
});
const MONSTER_ICON = L.icon({
  iconUrl: "/images/mk_monster.svg",
  iconSize: [58, 50],
  iconAnchor: [29, 42],
});

// 카메라 팔로우 — 내 위치가 바뀔 때마다 지도 중심을 이동.
function FollowMe({ lat, lng }: { lat: number; lng: number }) {
  const map = useMap();
  useEffect(() => {
    map.setView([lat, lng], map.getZoom(), { animate: true });
  }, [map, lat, lng]);
  return null;
}

export function PracticeMapScreen() {
  const { position, error } = usePracticePosition();
  const games = useGameStore((s) => s.games);
  const collection = useGameStore((s) => s.collection);
  const setGames = useGameStore((s) => s.setGames);
  const seqRef = useRef(0);

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

  // 조우 흐름(행사모드와 동일 훅) — 10m 근접 → AR → 퀴즈 → 도감.
  const myPos: GameLocation = position ?? { latitude: 0, longitude: 0 };
  const flow = useEncounterFlow({ games: active ? [active] : [], myPos });

  // 첫 GPS 픽스 전/에러 안내.
  if (error) {
    return (
      <Centered>
        <p className="text-base font-bold text-navy">{error}</p>
        <HomeButton />
      </Centered>
    );
  }
  if (!position) {
    return (
      <Centered>
        <p className="text-base font-bold text-navy">현재 위치를 확인하는 중…</p>
        <p className="text-sm text-navy/60">위치 권한을 허용해 주세요.</p>
      </Centered>
    );
  }

  return (
    <div className="relative h-[100dvh] w-full overflow-hidden">
      <MapContainer
        center={[position.latitude, position.longitude]}
        zoom={18}
        zoomControl={false}
        attributionControl={false}
        className="h-full w-full"
      >
        <TileLayer
          url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
          maxZoom={19}
        />
        <FollowMe lat={position.latitude} lng={position.longitude} />
        <Marker
          position={[position.latitude, position.longitude]}
          icon={ME_ICON}
        />
        {active && (
          <Marker
            position={[active.location.latitude, active.location.longitude]}
            icon={MONSTER_ICON}
          />
        )}
      </MapContainer>

      {/* 좌상단 메뉴(도감/초기화) — 행사모드와 공용. */}
      <MapMenu />

      {/* 조우 오버레이(흰 전환/기기안내/퀴즈/도감) — 지도 위 fixed. */}
      {flow.layers}
    </div>
  );
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
