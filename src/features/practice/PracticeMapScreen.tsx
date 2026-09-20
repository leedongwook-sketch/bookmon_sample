"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useGameStore } from "@/store/gameStore";
import { MapView } from "@/features/map/MapScreen";
import { Map3DView } from "@/features/map3d/Map3DScreen";
import { MAP_GOLD_BUTTON } from "@/features/map/mapButtonStyle";
import { usePracticePosition } from "./usePracticePosition";
import { buildPracticeGameData } from "./practiceData";

// 체험모드 지도 화면 — 서버 없이 **정적 게임데이터**를 gameStore(sessionStorage)에 세팅하고,
//   그다음부터는 행사모드와 **완전히 동일한** 화면/흐름(Map3DView·MapView·useEncounterFlow)을 쓴다.
//   차이는 오직 게임데이터 출처(하드코딩) + 몬스터 위치를 최초 GPS 픽스 기준으로 합성한 것뿐.
//   · 기본 3D(행사모드와 동일), 우상단 버튼으로 2D 로컬 전환.
//   · 이미 세팅돼 있으면(재진입) 재시딩하지 않아 진행 상황이 유지된다.
export function PracticeMapScreen() {
  const { position, error } = usePracticePosition();
  const setGameData = useGameStore((s) => s.setGameData);
  const games = useGameStore((s) => s.games);
  const eventMap = useGameStore((s) => s.eventMap);
  const playContext = useGameStore((s) => s.playContext);
  const [is3D, setIs3D] = useState(true);
  const seededRef = useRef(false);

  // 최초 GPS 픽스 → 정적 게임데이터 1회 세팅(행사모드 setGameData 와 동일 경로).
  //   이미 체험모드 데이터가 스토어에 있으면(세션 재진입) 재시딩 없이 그대로 사용(진행 유지).
  useEffect(() => {
    if (!position || seededRef.current) return;
    seededRef.current = true;
    const alreadySeeded = playContext?.mode === "practice" && games.length > 0;
    if (alreadySeeded) return;
    const data = buildPracticeGameData(position);
    setGameData(data.school, data.group, data.games, data.eventMap, {
      eventId: data.school.id,
      groupId: data.group.id,
      mode: "practice",
    });
  }, [position, playContext, games.length, setGameData]);

  if (error) {
    return (
      <Centered>
        <p className="text-base font-bold text-navy">{error}</p>
        <HomeButton />
      </Centered>
    );
  }
  if (!position || !eventMap || games.length === 0) {
    return (
      <Centered>
        <p className="text-base font-bold text-navy">현재 위치를 확인하는 중…</p>
        <p className="text-sm text-navy/60">위치 권한을 허용해 주세요.</p>
      </Centered>
    );
  }

  // 행사모드와 동일한 공용 지도 뷰 — 3D(기본) ↔ 2D 로컬 토글. variant="practice"(탭 조우·경고 없음).
  return is3D ? (
    <Map3DView
      eventMap={eventMap}
      games={games}
      myPos={position}
      variant="practice"
      modeSwitch={{ label: "2D 지도", onClick: () => setIs3D(false) }}
    />
  ) : (
    <MapView
      eventMap={eventMap}
      games={games}
      myPos={position}
      variant="practice"
      modeSwitch={{ label: "3D 지도", onClick: () => setIs3D(true) }}
    />
  );
}

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
