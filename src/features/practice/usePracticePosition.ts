"use client";

import { useEffect, useRef, useState } from "react";
import type { GameLocation } from "@/types";

// 실행모드 전용 실시간 위치 훅 — 항상 navigator.geolocation.watchPosition(live) 사용.
//   행사모드의 useMyPosition 은 테스트 고정좌표(USE_LIVE_POSITION=false)라 별도로 둔다.
//   첫 GPS 픽스 전에는 position=null(hasFix=false) → 화면이 "위치 확인 중"을 표시하고
//   몬스터 생성을 미룰 수 있게 한다.

const MIN_MOVE_M = 0.5; // 이 미만 이동은 무시(리렌더 폭주/지터 방지)

export interface PracticePosition {
  position: GameLocation | null; // 첫 픽스 전 null
  error: string | null; // 권한거부/미지원 등
}

export function usePracticePosition(): PracticePosition {
  const [position, setPosition] = useState<GameLocation | null>(null);
  const [error, setError] = useState<string | null>(null);
  const lastRef = useRef<GameLocation | null>(null);

  useEffect(() => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      // 1회 능력 체크(캐스케이드 아님) — geolocation 미지원 기기 안내.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setError("이 기기에서는 위치를 사용할 수 없어요.");
      return;
    }
    const onOk = (pos: GeolocationPosition) => {
      const next: GameLocation = {
        latitude: pos.coords.latitude,
        longitude: pos.coords.longitude,
      };
      const prev = lastRef.current;
      if (prev && roughMeters(prev, next) < MIN_MOVE_M) return; // 미세 이동 무시
      lastRef.current = next;
      setPosition(next);
      setError(null);
    };
    const onErr = (e: GeolocationPositionError) => {
      // 권한 거부/타임아웃 등 — 첫 픽스가 아직 없을 때만 에러 노출.
      if (!lastRef.current) {
        setError(
          e.code === e.PERMISSION_DENIED
            ? "위치 권한을 허용해 주세요."
            : "위치를 가져오지 못했어요."
        );
      }
    };
    const id = navigator.geolocation.watchPosition(onOk, onErr, {
      enableHighAccuracy: true,
      maximumAge: 1000,
      timeout: 15_000,
    });
    return () => navigator.geolocation.clearWatch(id);
  }, []);

  return { position, error };
}

function roughMeters(a: GameLocation, b: GameLocation): number {
  const dLat = (b.latitude - a.latitude) * 111_320;
  const dLng =
    (b.longitude - a.longitude) *
    111_320 *
    Math.cos((a.latitude * Math.PI) / 180);
  return Math.hypot(dLat, dLng);
}
