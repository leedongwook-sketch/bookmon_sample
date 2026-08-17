"use client";

import { useEffect, useRef, useState } from "react";
import type { GameLocation } from "@/types";

// ─────────────────────────────────────────────────────────────
// 데이터 소스 전환 플래그 (교체 가능 데이터 소스 패턴)
//   false = 고정 테스트 좌표(mock, 기본) — 현장이 아니어도 마커가 용인초 부지 안에 찍힘.
//   true  = 실 geolocation(watchPosition, live) — 실좌표 테스트 시에만 켠다(HTTPS 필요).
// ⚠ 실좌표 테스트 시 이 값을 true로 바꾼다. 평소엔 false 유지.
// ─────────────────────────────────────────────────────────────
const USE_LIVE_POSITION = false;

// 고정 테스트 좌표 — 용인초 부지 안 한 점(정북 정렬 부지 중앙 근처).
const TEST_POSITION: GameLocation = {
  latitude: 37.23825,
  longitude: 127.20516,
};

// 이 값(m) 미만 이동은 같은 위치로 보고 상태를 갱신하지 않는다(리렌더 폭주/GPS 지터 방지).
const MIN_MOVE_M = 0.5;

/**
 * 내 위치 훅 — 반환 시그니처(GameLocation)는 소스와 무관하게 동일.
 * 소비 컴포넌트(MapScreen/Map3D)는 이 훅만 쓰므로 mock↔live 전환에 불변.
 *
 * mock(기본): 고정 TEST_POSITION 반환. live: watchPosition 실좌표.
 * (훅 호출 순서를 지키려 항상 동일 구조로 실행하고, watch 활성화만 플래그로 가른다.)
 */
export function useMyPosition(): GameLocation {
  const [position, setPosition] = useState<GameLocation>(TEST_POSITION);
  const lastRef = useRef<GameLocation>(TEST_POSITION);

  useEffect(() => {
    // mock 모드에서는 watch를 걸지 않는다 → 항상 TEST_POSITION 고정.
    if (!USE_LIVE_POSITION) return;
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      return; // 미지원 → 폴백 유지
    }

    // live — navigator.geolocation.watchPosition 기반 실시간 좌표.
    //  - 실좌표가 들어오면 상태 갱신 → 마커 이동.
    //  - 미지원/비HTTPS/권한거부/오류 시 TEST_POSITION으로 안전 폴백.
    //  - MIN_MOVE_M 이상 이동 시에만 새 객체로 갱신(참조 안정). 언마운트 시 clearWatch.
    const onOk = (pos: GeolocationPosition) => {
      const next: GameLocation = {
        latitude: pos.coords.latitude,
        longitude: pos.coords.longitude,
      };
      // 실제 이동이 미미하면 갱신하지 않아 참조를 유지(리렌더 폭주 방지).
      if (roughMeters(lastRef.current, next) < MIN_MOVE_M) return;
      lastRef.current = next;
      setPosition(next);
    };

    const onErr = () => {
      // 권한거부/타임아웃 등 → 폴백 유지(상태 변경 없음).
    };

    const watchId = navigator.geolocation.watchPosition(onOk, onErr, {
      enableHighAccuracy: true,
      maximumAge: 1000,
      timeout: 10_000,
    });

    return () => navigator.geolocation.clearWatch(watchId);
  }, []);

  return position;
}

// 두 좌표 간 대략 거리(m). 소규모 부지라 평면 근사로 충분.
function roughMeters(a: GameLocation, b: GameLocation): number {
  const dLat = (b.latitude - a.latitude) * 111_320;
  const dLng =
    (b.longitude - a.longitude) *
    111_320 *
    Math.cos((a.latitude * Math.PI) / 180);
  return Math.hypot(dLat, dLng);
}
