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
import { getMonstersInRange, ARRIVAL_RADIUS_M } from "./geo";
import { isMobileDevice } from "@/lib/device";
import { QuizLayer } from "@/features/quiz/QuizLayer";
import { CollectionLayer } from "@/features/collection/CollectionLayer";
import type { Game, GameLocation } from "@/types";

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
  const capture = useGameStore((s) => s.capture);
  const collection = useGameStore((s) => s.collection);
  const [fadePhase, setFadePhase] = useState<FadePhase>("idle"); // 흰 화면 전환 단계
  const [quizGame, setQuizGame] = useState<Game | null>(null); // 퀴즈 레이어 대상(포획 성공 몬스터)
  const [showCollection, setShowCollection] = useState(false); // 도감 레이어 표시
  const [deviceBlocked, setDeviceBlocked] = useState(false); // PC 등 비모바일 → AR 불가 안내 표시
  const [leaving, setLeaving] = useState(false); // 이동 중(흰 화면 채운 뒤 launchAr 대기) — 재진입 가드
  const transitionTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const handledRef = useRef<Set<string>>(new Set()); // 이미 조우 처리한 몬스터(중복 트리거 방지)
  const openCollectionRef = useRef(false); // 정답 시 퀴즈 닫힘 후 도감 열기 예약
  const consumedRef = useRef(false); // 복귀 결과 소비 1회 가드(StrictMode/재실행 방어)

  // 조우 시작: 화면을 흰색으로 덮으며(0.7초) `/ar/shooting/`로 전체 이동. (실 도착/테스트 클릭 공용)
  const beginEncounter = useCallback(
    (game: Game) => {
      if (leaving || transitionTimer.current) return; // 이미 진행 중이면 무시

      // AR 콘텐츠 요청 전 기기 체크 — 카메라·자이로가 필요해 스마트폰에서만 실행 가능.
      // PC(비모바일)면 흰 화면 전환/이동 없이 안내만 띄운다(불필요한 흰 플래시 방지).
      if (!isMobileDevice()) {
        setDeviceBlocked(true);
        return; // AR 요청 취소
      }

      setLeaving(true);
      setFadePhase("in"); // 흰 화면 페이드 인 시작(0.7초)

      // 흰 화면이 꽉 찬 뒤 전체 페이지 이동 → AR 로딩을 흰색이 가린다.
      // launchAr 이 image 해결 + req 기록 + location.assign("/ar/shooting/") 까지 수행.
      transitionTimer.current = setTimeout(() => {
        transitionTimer.current = null;
        launchAr(game);
      }, FADE_IN_MS);
    },
    [leaving]
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
    // AR 복귀가 아니면(결과 없음) 흰 페이드도 소비도 없음 — 일반 진입엔 미적용(§4-4 Med).
    if (!hasArResult()) return;

    const run = () => {
      if (consumedRef.current) return; // 1회 소비 가드
      const store = useGameStore.getState();
      const result = consumeArResult(store.games); // read→검증→키삭제(먼저) 후 반환
      consumedRef.current = true;

      // AR 복귀 → 흰→지도 페이드 아웃(성공/실패/닫기 공통, 이동 연속성).
      // idle 전환은 아래 전용 effect가 fadePhase 기준으로 처리한다(StrictMode 안전 —
      // 여기서 타이머를 걸면 마운트 cleanup이 지워 fadePhase가 "out"에 멈춰 터치가 막힌다).
      setFadePhase("out");

      if (!result) return; // 위조/증표없음/만료 → 무반응(정리만 됨)

      // 리로드로 handledRef 가 비어 근접 재트리거가 도는 것을 막는다(§4-4).
      handledRef.current.add(result.game.id);

      if (result.ok) {
        // [테스트] AR 포획 성공 → 도감에 추가 + 잠깐 뒤 도감 레이어 표시.
        // 원복(실서비스 퀴즈 흐름): 아래 두 줄을 `setQuizGame(result.game)` 한 줄로 되돌리면
        //   성공 → 퀴즈 → 정답 시 도감 흐름이 복구된다.
        capture(result.game.monster);
        window.setTimeout(() => setShowCollection(true), 350);
      } else {
        // 실패/닫기 → 포획 없음. close 쿨다운을 남겨 근접 즉시 재트리거 루프 방지(§4-4).
        markDismissed(result.game.id);
      }
    };

    // 하이드레이션 게이트: 복원 완료 후 games 로 검증. 이미 복원됐으면 즉시 실행.
    if (useGameStore.persist.hasHydrated()) {
      run();
      return;
    }
    const unsub = useGameStore.persist.onFinishHydration(run);
    return unsub;
  }, [capture]);

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

      {/* 퀴즈 레이어 — 포획 성공 시 해당 몬스터 퀴즈 표시 (실서비스 흐름. 현재 테스트는 도감 직행) */}
      {quizGame && (
        <QuizLayer
          quiz={quizGame.quiz}
          // 책이름(제목) — 현재 책 제목 데이터가 없어 몬스터명을 임시로 사용.
          // TODO(실서비스): 퀴즈/책 제목 필드가 생기면 그것으로 교체.
          title={quizGame.monster.koreanName}
          onCorrect={() => {
            // 정답 → 도감에 포획 몬스터 추가 + (퀴즈 닫힌 뒤) 도감 레이어 열기 예약
            capture(quizGame.monster);
            openCollectionRef.current = true;
          }}
          onWrong={() => {
            // TODO(실서비스): 오답 처리
          }}
          onTimeout={() => {
            // TODO(실서비스): 시간초과 처리
          }}
          onClose={() => {
            setQuizGame(null);
            if (openCollectionRef.current) {
              openCollectionRef.current = false;
              setShowCollection(true); // 정답이었으면 도감 레이어 표시
            }
          }}
        />
      )}

      {/* 도감 레이어 — 포획 성공 후 표시(모듈 재사용). */}
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
