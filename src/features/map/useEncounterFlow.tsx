"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useGameStore } from "@/store/gameStore";
import {
  launchAr,
  consumeArResult,
  markDismissed,
  isDismissed,
  hasArResult,
} from "./arBridge";
import { mountAr } from "./arInject";
import { getMonstersInRange, ARRIVAL_RADIUS_M } from "./geo";
import { isMobileDevice } from "@/lib/device";
import { CollectionLayer } from "@/features/collection/CollectionLayer";
import type { Game, GameLocation } from "@/types";

// ⚠ [테스트 전용] 책(몬스터) 클릭 시 AR 콘텐츠를 건너뛰고 바로 퀴즈(성공 이벤트)로 진입.
//   true 로 바꾸면 AR을 건너뛰고 바로 퀴즈로(PC 테스트용).
const SKIP_AR_TO_QUIZ = false;

// AR 실행 방식 분기 —
//   기본(false): C안 navigate — /ar/shooting/ 전체 페이지 이동 후 복귀(reload)로 결과 소비.
//   통합(true) : 단일 문서 주입 — 현재 문서에 AR 을 mount, __bookmonEmbeddedDone 콜백으로 결과 수신.
//   플래그는 통합 프로젝트(bookmon_unified) 빌드에서만 NEXT_PUBLIC_AR_EMBEDDED="true" 로 켠다.
//   → front 단독은 항상 navigate, 통합 산출물만 주입. (소스는 front 한 곳에서만 관리)
const AR_EMBEDDED = process.env.NEXT_PUBLIC_AR_EMBEDDED === "true";

const FADE_IN_MS = 700; // 흰 화면으로 덮이는 시간(발견 → AR 페이지로 이동 직전까지)
const FADE_OUT_MS = 600; // 복귀 시 흰 화면을 걷어 지도를 드러내는 시간
const DISMISS_COOLDOWN_MS = 60_000; // close 후 근접 재트리거 억제 시간(§4-4)

// 전환 단계: idle=없음, in=흰색으로 덮는 중(이동 직전), out=복귀 후 흰색을 걷는 중.
type FadePhase = "idle" | "in" | "out";

/**
 * 몬스터 조우 흐름 (2D·3D 공용). — AR 통합 C안(전체 페이지 이동 방식).
 *  - 근접(반경 10m 진입) 또는 테스트 클릭 → 흰 페이드 인(0.7초) → `/ar/shooting/` 전체 이동.
 *  - AR 종료 → sessionStorage 결과 기록 후 원래 지도로 복귀 → 검증 게이트 통과 시 포획.
 *  - [테스트] 포획 성공 → 도감 레이어. (실서비스 퀴즈 흐름은 주석 유지)
 * 상태머신/근접판정을 담고, 화면에 얹을 오버레이는 layers 로 렌더한다.
 */
export interface EncounterFlow {
  beginEncounter: (game: Game) => void; // 조우 시작(근접감지/테스트 클릭 공용)
  layers: React.ReactNode; // 전환/기기안내/퀴즈/도감 오버레이 (DOM 오버레이 — Canvas 위에도 얹힘)
}

export function useEncounterFlow({
  games,
  myPos,
}: {
  games: Game[];
  myPos: GameLocation;
}): EncounterFlow {
  const recordResult = useGameStore((s) => s.recordResult);
  const collection = useGameStore((s) => s.collection);
  const [fadePhase, setFadePhase] = useState<FadePhase>("idle"); // 흰 화면 전환 단계
  const [showCollection, setShowCollection] = useState(false); // 도감 레이어 표시
  const [deviceBlocked, setDeviceBlocked] = useState(false); // PC 등 비모바일 → AR 불가 안내 표시
  const [leaving, setLeaving] = useState(false); // 이동 중(흰 화면 채운 뒤 launchAr 대기) — 재진입 가드
  const transitionTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const handledRef = useRef<Set<string>>(new Set()); // 이미 조우 처리한 몬스터(중복 트리거 방지)
  const consumedRef = useRef(false); // 복귀 결과 소비 1회 가드(StrictMode/재실행 방어)

  // 결과 분기(navigate·embedded 공용) — 퀴즈는 AR 안에서 진행되므로 여기선 최종 결과만 반영.
  //   success(포획+퀴즈 정답)→도감 획득 / fail(도망·퀴즈 오답·시간초과)→도감 실패 / close→쿨다운.
  const applyResult = useCallback(
    (game: Game, ar: "success" | "fail" | "close") => {
      handledRef.current.add(game.id); // 재트리거 방지
      if (ar === "success") {
        recordResult(game.monster, true); // 획득 기록
        setShowCollection(true); // 지도 위 도감 표시
      } else if (ar === "fail") {
        recordResult(game.monster, false); // 실패 기록 → 도감(회색+X)
        setShowCollection(true);
      } else {
        markDismissed(game.id); // 닫기 → 쿨다운만
      }
    },
    [recordResult]
  );

  // 조우 시작: 화면을 흰색으로 덮으며(0.7초) `/ar/shooting/`로 전체 이동. (실 도착/테스트 클릭 공용)
  const beginEncounter = useCallback(
    (game: Game) => {
      if (leaving || transitionTimer.current) return; // 이미 진행 중이면 무시

      // ⚠ [테스트] AR 스킵 → 포획 성공으로 간주하고 바로 도감(퀴즈는 이제 AR 안에서 진행).
      //   기기 체크·흰 페이드·AR 이동을 건너뛴다(PC 테스트용). 원복: SKIP_AR_TO_QUIZ=false.
      if (SKIP_AR_TO_QUIZ) {
        applyResult(game, "success");
        return;
      }

      // AR 콘텐츠 요청 전 기기 체크 — 카메라·자이로가 필요해 스마트폰에서만 실행 가능.
      // PC(비모바일)면 흰 화면 전환/이동 없이 안내만 띄운다(불필요한 흰 플래시 방지).
      if (!isMobileDevice()) {
        setDeviceBlocked(true);
        return; // AR 요청 취소
      }

      setLeaving(true);
      setFadePhase("in"); // 흰 화면 페이드 인 시작(0.7초)

      // 흰 화면이 꽉 찬 뒤 AR 실행. 방식은 AR_EMBEDDED 로 분기.
      transitionTimer.current = setTimeout(() => {
        transitionTimer.current = null;
        if (AR_EMBEDDED) {
          // 단일 문서 주입 — 현재 문서에 mount, 결과는 콜백으로. 내비게이션 없음(전체화면 유지).
          //   AR 자체 흰 boot-overlay 가 이어받으므로 우리 흰 화면은 내려도 됨(AR 오버레이가 최상위).
          mountAr(game, (res) => {
            setLeaving(false);
            setFadePhase("out");
            applyResult(game, res.ar);
          });
          setFadePhase("idle");
        } else {
          // C안 navigate — launchAr 이 req 기록 + location.assign("/ar/shooting/") 수행(복귀 시 소비).
          launchAr(game);
        }
      }, FADE_IN_MS);
    },
    [leaving, applyResult]
  );

  useEffect(
    () => () => {
      if (transitionTimer.current) clearTimeout(transitionTimer.current);
    },
    []
  );

  // 흰 페이드 아웃 자동 종료 — fadePhase 기준(StrictMode 안전: 자체 타이머만 관리).
  // "out" 애니메이션(0.6초) 후 오버레이를 언마운트해 지도 터치를 되살린다.
  useEffect(() => {
    if (fadePhase !== "out") return;
    const t = setTimeout(() => setFadePhase("idle"), FADE_OUT_MS);
    return () => clearTimeout(t);
  }, [fadePhase]);

  // ── AR 복귀 핸들러 (마운트 시) — §4-2 검증 게이트 + §4-4 리로드 방어 ──
  // 전체 이동으로 앱이 리로드되므로 persist 하이드레이션 완료(games 준비) 후 소비해야 한다.
  // (games 가 비어 있으면 mid 실존 검증이 실패해 포획이 유실됨 — §4-4 High)
  useEffect(() => {
    // 주입 모드는 복귀(reload)가 없다 → 콜백으로 처리하므로 이 효과는 navigate 모드 전용.
    if (AR_EMBEDDED) return;
    // AR 복귀가 아니면(결과 없음) 흰 페이드도 소비도 없음 — 일반 진입엔 미적용(§4-4 Med).
    if (!hasArResult()) return;

    const run = () => {
      if (consumedRef.current) return; // 1회 소비 가드
      const store = useGameStore.getState();
      const result = consumeArResult(store.games); // read→검증→키삭제(먼저) 후 반환
      consumedRef.current = true;

      // AR 복귀 → 흰→지도 페이드 아웃(성공/실패/닫기 공통, 이동 연속성).
      setFadePhase("out");

      if (!result) return; // 위조/증표없음/만료 → 무반응(정리만 됨)

      // 리로드로 handledRef 가 비어 근접 재트리거가 도는 것을 막고, 결과 분기(navigate·embedded 공용).
      applyResult(result.game, result.ok ? "success" : result.ar);
    };

    // 하이드레이션 게이트: 복원 완료 후 games 로 검증. 이미 복원됐으면 즉시 실행.
    if (useGameStore.persist.hasHydrated()) {
      run();
      return;
    }
    const unsub = useGameStore.persist.onFinishHydration(run);
    return unsub;
  }, [applyResult]);

  // 도착 판정: 매 렌더(내 위치 변경 시) 반경 10m 내 몬스터 검출.
  const nearby = getMonstersInRange(
    games,
    myPos.latitude,
    myPos.longitude,
    ARRIVAL_RADIUS_M
  );
  const arrivedId = nearby[0]?.id ?? null;

  // 도착한 몬스터가 처음 감지되면 조우 시작(중복 방지). GPS 연동 전까지는 대개 트리거 안 됨.
  useEffect(() => {
    if (!arrivedId || leaving || fadePhase !== "idle") return;
    if (handledRef.current.has(arrivedId)) return;
    // §4-4 근접 가드 강화: 이미 포획됐거나(collection) close 쿨다운 중이면 스킵.
    if (collection.some((e) => e.monsterId === arrivedId)) return;
    if (isDismissed(arrivedId, DISMISS_COOLDOWN_MS)) return;
    const game = games.find((g) => g.id === arrivedId);
    if (!game) return;
    handledRef.current.add(arrivedId);
    // GPS 도착(외부 이벤트) 감지 → 조우 시작. beginEncounter 내부에서 상태를 바꾸지만
    // 위 가드(leaving/fadePhase)로 재진입이 막혀 캐스케이드가 없다(의도된 트리거).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    beginEncounter(game);
  }, [arrivedId, leaving, fadePhase, games, collection, beginEncounter]);

  const layers = (
    <>
      {/* 흰 화면 전환 — 발견 시 화면을 덮은 뒤(in, 0.7초) AR 페이지로 이동.
          복귀 시엔 흰색을 걷어 지도를 드러낸다(out). */}
      {fadePhase !== "idle" && <ArFadeTransition phase={fadePhase} />}

      {/* 비모바일(PC) 안내 — AR은 스마트폰에서만 실행 가능. 요청은 이미 취소됨. */}
      {deviceBlocked && (
        <MobileOnlyNotice onClose={() => setDeviceBlocked(false)} />
      )}

      {/* 퀴즈는 AR 카메라 위에서 진행된다(계약 v3 req.quiz → AR window.__bookmonQuiz).
          AR 이 정답=success·오답/시간초과=fail 로 종료 → applyResult 가 최종 도감을 표시한다. */}

      {/* 도감 레이어 — AR(포획+퀴즈) 종료 후 표시(모듈 재사용). */}
      {showCollection && (
        <CollectionLayer onClose={() => setShowCollection(false)} />
      )}
    </>
  );

  return { beginEncounter, layers };
}

// AR 전환 오버레이 — 발견 시 화면 전체를 흰색으로 덮고(in, 0.7초 뒤 페이지 이동),
// 복귀 시 흰색을 걷어(out) 지도를 드러낸다. 전환 중 탭은 차단.
function ArFadeTransition({ phase }: { phase: "in" | "out" }) {
  const isIn = phase === "in";
  return (
    <div
      // in(덮는 중)엔 탭 차단, out(지도 드러내는 중)엔 통과 — 복귀 후 터치가 막히지 않게(방어).
      onPointerDown={isIn ? (e) => e.stopPropagation() : undefined}
      className={`fixed inset-0 z-[65] bg-white ${isIn ? "" : "pointer-events-none"}`}
      style={{
        animation: isIn
          ? `ar-fade-in ${FADE_IN_MS}ms ease-in forwards`
          : `ar-fade-out ${FADE_OUT_MS}ms ease-out forwards`,
      }}
    />
  );
}

// 비모바일(PC) 안내 모달 — AR은 카메라·자이로가 필요해 스마트폰에서만 실행 가능.
// 화면 전체를 덮는 딤 + 중앙 카드. 확인/딤 탭으로 닫는다.
function MobileOnlyNotice({ onClose }: { onClose: () => void }) {
  return (
    <div
      onPointerDown={(e) => e.stopPropagation()}
      onClick={onClose}
      className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 px-6"
    >
      <div
        role="alertdialog"
        aria-label="스마트폰에서만 실행 가능"
        onClick={(e) => e.stopPropagation()}
        className="flex w-[min(88vw,340px)] flex-col items-center gap-3 rounded-[20px] border-2 border-navy bg-ivory px-6 py-7 text-center shadow-[0_14px_28px_rgba(0,0,0,0.45)]"
      >
        <div className="flex h-14 w-14 items-center justify-center rounded-full border-2 border-navy bg-gold text-3xl">
          📱
        </div>
        <p className="text-lg font-extrabold text-navy">
          스마트폰에서만 실행 가능해요
        </p>
        <p className="text-sm leading-relaxed text-navy/70">
          AR 몬스터 잡기는 카메라와 자이로 센서가 필요해요.
          <br />
          스마트폰으로 접속해 주세요.
        </p>
        <button
          type="button"
          onClick={onClose}
          className="mt-2 flex h-11 w-full items-center justify-center rounded-full border-2 border-navy bg-gold text-base font-extrabold text-navy shadow-[inset_0_2px_0_rgba(255,255,255,0.5)] active:translate-y-[1px]"
        >
          확인
        </button>
      </div>
    </div>
  );
}
