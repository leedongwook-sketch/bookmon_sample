"use client";

import { useEffect, useRef, useState } from "react";
import type { GameLocation } from "@/types";

// ─────────────────────────────────────────────────────────────
// 데이터 소스 전환 플래그 (교체 가능 데이터 소스 패턴)
//   true  = 실 geolocation(watchPosition, live) — 실모드(현장). 마커가 실제 위치로 이동. (HTTPS 필요)
//   false = 고정 테스트 좌표(mock) — 현장이 아니어도 마커가 지도 안에 찍힘(개발용).
// 실모드(원래 의도 기능): 실 GPS + 10m 근접 시 자동 조우. 책상 테스트가 필요하면 false 로 임시 전환.
// ─────────────────────────────────────────────────────────────
const USE_LIVE_POSITION = true;

// 고정 테스트 좌표 — 테스트 행사장(경명여중 일대) bbox 중앙 근처.
//   bbox: 위도 [37.3647360, 37.3664570], 경도 [126.9294180, 126.9327090]
const TEST_POSITION: GameLocation = {
  latitude: 37.365596,
  longitude: 126.931063,
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

// ─────────────────────────────────────────────────────────────
// 나침반 헤딩 훅 — 내 위치 화살표/3D course-up 회전용 (2D·3D 공용).
//
// 반환값: **연속각(unwrapped) 헤딩(도)**. 0=북, 시계방향. 359↔0 경계를 넘으면
//   -1·361처럼 이어지므로 CSS rotate/3D lerp에 그대로 써도 한 바퀴 도는 튐이 없다.
//   (나침반 눈금값이 필요하면 ((h % 360) + 360) % 360.)
//
// 플랫폼별 소스:
//   · iOS Safari — deviceorientation 의 webkitCompassHeading(0=북, 시계방향).
//     권한(DeviceOrientationEvent.requestPermission)은 앱 시작 게이트(primeArPermissions)
//     에서 이미 선요청됨 → 여기서는 재요청 없이 리스너만 등록한다.
//   · Android/Chromium — deviceorientationabsolute(없으면 deviceorientation)의
//     alpha(반시계) → 헤딩 = 360 - alpha. 비absolute 폴백은 기기 초기방향 기준이라 부정확할 수 있음.
//   · 공통 — 센서값은 기기 세로 상단 기준이라 화면 회전각(screen.orientation.angle)을 가산.
//   · 데스크톱/센서 미지원/권한 거부 — 이벤트가 오지 않아 null 유지(호출부는 회전 생략).
// ─────────────────────────────────────────────────────────────

const HEADING_SMOOTHING = 0.35; // 이벤트당 목표각으로 접근하는 비율(저역 필터)
const HEADING_MIN_DELTA_DEG = 1; // 이 미만 변화는 상태 갱신 생략(리렌더 억제)
const HEADING_UPDATE_MS = 100; // 상태 갱신 최소 간격(센서 이벤트는 30~60Hz)

export function useCompassHeading(): number | null {
  const [heading, setHeading] = useState<number | null>(null);
  const smoothRef = useRef<number | null>(null); // 필터 내부 연속각(모든 이벤트 반영)
  const lastEmitRef = useRef<{ t: number; v: number } | null>(null); // 마지막 상태 방출

  useEffect(() => {
    if (typeof window === "undefined") return;

    // 화면 회전 보정 — 가로모드에선 UI 위쪽과 기기 상단이 다르다. 미지원 브라우저는 0.
    const screenAngle = (): number => {
      const angle = window.screen?.orientation?.angle;
      if (typeof angle === "number") return angle;
      const legacy = (window as Window & { orientation?: number }).orientation;
      return typeof legacy === "number" ? legacy : 0;
    };

    // 원시 헤딩(0~360) → 최단 경로 차이(-180~180)로 연속각 누적 + 저역 필터 → 스로틀 방출.
    const apply = (raw: number) => {
      const prev = smoothRef.current;
      let next: number;
      if (prev === null) {
        next = raw;
      } else {
        const prevMod = ((prev % 360) + 360) % 360;
        let diff = raw - prevMod;
        diff = ((diff % 360) + 540) % 360 - 180; // wrap 처리(-180~180)
        next = prev + diff * HEADING_SMOOTHING;
      }
      smoothRef.current = next;

      const now = Date.now();
      const last = lastEmitRef.current;
      if (last) {
        if (now - last.t < HEADING_UPDATE_MS) return;
        if (Math.abs(next - last.v) < HEADING_MIN_DELTA_DEG) return;
      }
      lastEmitRef.current = { t: now, v: next };
      setHeading(next);
    };

    const onOrientation = (e: DeviceOrientationEvent) => {
      // iOS Safari — webkitCompassHeading(0=북, 시계방향, 기기 상단 기준).
      const webkit = (
        e as DeviceOrientationEvent & { webkitCompassHeading?: number }
      ).webkitCompassHeading;
      if (typeof webkit === "number" && !Number.isNaN(webkit)) {
        apply((webkit + screenAngle() + 360) % 360);
        return;
      }
      // Android/Chromium — alpha(반시계, 0~360) → 시계방향 헤딩.
      if (e.alpha !== null && e.alpha !== undefined) {
        apply((360 - e.alpha + screenAngle() + 360) % 360);
      }
    };

    // Chromium은 절대 기준 이벤트 우선(자기 센서 융합), 그 외(iOS 포함)는 deviceorientation.
    const eventName =
      "ondeviceorientationabsolute" in window
        ? "deviceorientationabsolute"
        : "deviceorientation";
    window.addEventListener(eventName, onOrientation as EventListener);
    return () =>
      window.removeEventListener(eventName, onOrientation as EventListener);
  }, []);

  return heading;
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
