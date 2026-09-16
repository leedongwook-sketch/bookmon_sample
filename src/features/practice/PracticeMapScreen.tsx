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

// 내 위치 마커 — 파란 레이더 번짐(animate-ping) + 화살표 이미지(행사모드 2D와 동일 감).
//   Leaflet divIcon 으로 HTML 구성. 클래스는 소스 리터럴이라 Tailwind JIT 가 감지.
//   /images 경로는 배포 시 gh-pages-rewrite 가 basePath 접두.
const ME_DIV_ICON = L.divIcon({
  className: "",
  html: `<div class="relative h-12 w-12">
    <span class="absolute left-1/2 top-1/2 h-9 w-9 -translate-x-1/2 -translate-y-1/2 animate-ping rounded-full bg-skyblue/40"></span>
    <img src="/images/mk_player.png" alt="" class="relative block" style="width:48px;height:48px" draggable="false" />
  </div>`,
  iconSize: [48, 48],
  iconAnchor: [24, 24],
});
const MONSTER_ICON = L.icon({
  iconUrl: "/images/mk_monster.svg",
  iconSize: [56, 60],
  iconAnchor: [28, 54],
});

// 카메라 팔로우 — 내 위치가 바뀔 때마다 지도 중심을 부드럽게 이동(마커 전환 0.5s와 동기).
function FollowMe({ lat, lng }: { lat: number; lng: number }) {
  const map = useMap();
  useEffect(() => {
    map.panTo([lat, lng], { animate: true, duration: 0.5, easeLinearity: 0.5 });
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
  //   추가: 책 마커를 클릭해도 조우 시작(테스트/수동 트리거).
  const myPos: GameLocation = position ?? { latitude: 0, longitude: 0 };
  const { beginEncounter, layers } = useEncounterFlow({
    games: active ? [active] : [],
    myPos,
  });

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
        zoom={19}
        zoomControl={false}
        attributionControl={false}
        // isolate: Leaflet 내부 pane(z 200~700)을 독립 스택으로 가둬 상단 메뉴(MapMenu)가 지도에 안 가리게.
        // smooth-markers: 마커 이동을 CSS 전환으로 부드럽게(globals.css).
        // map-pastel: 타일에 파스텔+세피아 필터를 얹어 북몬 아이보리 톤으로(globals.css).
        className="smooth-markers map-pastel isolate h-full w-full"
      >
        {/* CyclOSM — 무료·API키 불필요·한국 고줌 실타일 지원. OSM 표준보다 파스텔톤이라 예쁨.
            + .map-pastel CSS 필터로 채도↓·살짝 세피아 → 북몬 아이보리 톤과 조화, 마커 가독성↑.
            ※ CARTO·Stadia·VWorld 등 더 미니멀한 스타일은 API 키/계정이 필요해 제외. {s}=a~c. */}
        <TileLayer
          url="https://{s}.tile-cyclosm.openstreetmap.fr/cyclosm/{z}/{x}/{y}.png"
          subdomains="abc"
          maxZoom={20}
        />
        <FollowMe lat={position.latitude} lng={position.longitude} />
        <Marker
          position={[position.latitude, position.longitude]}
          icon={ME_DIV_ICON}
        />
        {active && (
          <Marker
            position={[active.location.latitude, active.location.longitude]}
            icon={MONSTER_ICON}
            eventHandlers={{ click: () => beginEncounter(active) }}
          />
        )}
      </MapContainer>

      {/* 좌상단 메뉴(도감/초기화) — 행사모드와 공용. */}
      <MapMenu />

      {/* 조우 오버레이(흰 전환/기기안내/퀴즈/도감) — 지도 위 fixed. */}
      {layers}
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
