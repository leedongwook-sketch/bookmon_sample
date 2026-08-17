"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useGameStore } from "@/store/gameStore";
import { useArSession } from "./useArSession";
import { ArOverlay } from "./ArOverlay";
import { getMonstersInRange, ARRIVAL_RADIUS_M } from "./geo";
import { QuizLayer } from "@/features/quiz/QuizLayer";
import { CollectionLayer } from "@/features/collection/CollectionLayer";
import type { Game, GameLocation } from "@/types";

const ENCOUNTER_BANNER_MS = 2000; // '몬스터 발견' 배너 표시 후 AR 진입까지
const DEFAULT_HIT_COUNT = 3; // TODO(실서비스): 몬스터/서버별 타격 횟수로 대체

/**
 * 몬스터 조우 흐름 (2D·3D 공용).
 *  - 근접(반경 10m 진입) 또는 테스트 클릭 → '몬스터 발견' 배너 → 2초 후 AR(iframe) 진입.
 *  - AR 포획 성공 → 퀴즈 레이어 → 정답 시 도감 포획 + 도감 레이어.
 *  - 상태머신/근접판정을 담고, 화면에 얹을 오버레이는 <EncounterLayers>로 렌더한다.
 *
 * 2D(MapScreen)에 인라인돼 있던 로직을 순수 추출한 것 — 동작/타이밍/UX 동일.
 */
export interface EncounterFlow {
  encounterName: string | null; // 배너에 표시 중인 몬스터명(없으면 null)
  beginEncounter: (game: Game) => void; // 조우 시작(근접감지/테스트 클릭 공용)
  layers: React.ReactNode; // 배너/AR/퀴즈/도감 오버레이 (DOM 오버레이 — Canvas 위에도 그대로 얹힘)
}

export function useEncounterFlow({
  games,
  myPos,
}: {
  games: Game[];
  myPos: GameLocation;
}): EncounterFlow {
  const capture = useGameStore((s) => s.capture);
  const { session, openArSession, closeArSession } = useArSession();
  const [encounterName, setEncounterName] = useState<string | null>(null); // 배너 표시 중인 몬스터명
  const [quizGame, setQuizGame] = useState<Game | null>(null); // 퀴즈 레이어 대상(포획 성공 몬스터)
  const [showCollection, setShowCollection] = useState(false); // 도감 레이어 표시
  const encounterTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const handledRef = useRef<Set<string>>(new Set()); // 이미 조우 처리한 몬스터(중복 트리거 방지)
  const openCollectionRef = useRef(false); // 정답 시 퀴즈 닫힘 후 도감 열기 예약

  // 조우 시작: 배너 → 2초 → AR. (실 도착 이벤트 / 테스트 클릭 공용)
  const beginEncounter = useCallback(
    (game: Game) => {
      if (session || encounterTimer.current) return; // 이미 진행 중이면 무시
      setEncounterName(game.monster.koreanName);
      encounterTimer.current = setTimeout(() => {
        encounterTimer.current = null;
        setEncounterName(null); // 배너 내리고 AR로 전환
        openArSession({
          // 몬스터 스프라이트 경로. mock은 thumbnail256Url이 null → "" 전달 →
          // ArOverlay가 image 파라미터를 생략 → 8thwall 번들 내장 bookmon1.png로 폴백(테스트).
          // 실서비스: thumbnail256Url이 채워지면 그 경로가 그대로 8thwall로 전달됨(자동 대응).
          imageUrl: game.monster.thumbnail256Url ?? "",
          hitCount: DEFAULT_HIT_COUNT,
          onSuccess: () => {
            // [테스트] AR 포획 성공 → (AR은 이미 페이드아웃됨) iframe 닫아 지도로 전환
            //   → 잠깐 뒤 도감 레이어 표시. 도감엔 방금 포획 몬스터가 추가된다.
            // 원복(실서비스 퀴즈 흐름): 아래를 `setQuizGame(game)` 한 줄로 되돌리면
            //   성공 → 퀴즈 → 정답 시 도감 흐름이 복구된다.
            capture(game.monster);
            closeArSession(); // AR iframe 제거 → 지도 노출(페이드아웃 완료 후라 자연스러움)
            window.setTimeout(() => setShowCollection(true), 350); // 지도 잠깐 보인 뒤 도감
          },
          onFail: () => {
            // [테스트] 실패 → 후속 처리 없음. ArOverlay가 onClose로 iframe을 닫아 지도로 복귀.
            // TODO(실서비스): 실패 처리(재도전/패널티 등).
          },
        });
      }, ENCOUNTER_BANNER_MS);
    },
    [session, openArSession, capture, closeArSession]
  );

  useEffect(
    () => () => {
      if (encounterTimer.current) clearTimeout(encounterTimer.current);
    },
    []
  );

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
    if (!arrivedId || session || encounterName) return;
    if (handledRef.current.has(arrivedId)) return;
    const game = games.find((g) => g.id === arrivedId);
    if (!game) return;
    handledRef.current.add(arrivedId);
    beginEncounter(game);
  }, [arrivedId, session, encounterName, games, beginEncounter]);

  const layers = (
    <>
      {/* 조우 배너 — 도착/트리거 시 '몬스터 발견' 표시(2초 후 AR로 전환) */}
      {encounterName && <DiscoveryBanner monster={encounterName} />}

      {/* AR 오버레이 — 조우 시 self-hosted 번들 iframe */}
      {session && <ArOverlay {...session} onClose={closeArSession} />}

      {/* 퀴즈 레이어 — 포획 성공 시 해당 몬스터 퀴즈 표시 */}
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
            // 퀴즈 종료 시 그 아래 AR iframe도 함께 닫는다.
            setQuizGame(null);
            closeArSession();
            if (openCollectionRef.current) {
              openCollectionRef.current = false;
              setShowCollection(true); // 정답이었으면 도감 레이어 표시
            }
          }}
        />
      )}

      {/* 도감 레이어 — 포획 성공 후 표시(모듈 재사용).
          닫을 때 그 아래 AR iframe도 함께 정리(퀴즈 경유 시엔 이미 닫혀 있어 무해). */}
      {showCollection && (
        <CollectionLayer
          onClose={() => {
            setShowCollection(false);
            closeArSession();
          }}
        />
      )}
    </>
  );

  return { encounterName, beginEncounter, layers };
}

// 도착 이벤트 — 화면 상단 중앙에 '몬스터 발견' 표시.
function DiscoveryBanner({ monster }: { monster: string }) {
  return (
    <div className="pointer-events-none absolute left-1/2 top-[max(1rem,var(--spacing-safe-t))] z-10 -translate-x-1/2">
      <div className="rounded-full border-2 border-navy bg-gold px-5 py-2 text-center text-base font-extrabold text-navy shadow-lg [text-shadow:0_1px_0_rgba(255,255,255,0.4)]">
        몬스터 발견! · {monster}
      </div>
    </div>
  );
}
