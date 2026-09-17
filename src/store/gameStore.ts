import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type {
  SchoolSearchResult,
  PlayGroup,
  Game,
  Monster,
  EventMap,
  PlayContext,
  CollectionEntry,
  GameMode,
  GroundLayout,
} from "@/types";
import { GAME_STORAGE_KEY } from "@/constants/storage";

interface GameState {
  // ── 상태 ─────────────────────────────
  mode: GameMode | null; // BM-101 선택 결과
  event: SchoolSearchResult | null; // 선택한 행사(학교) {id, place}
  group: PlayGroup | null; // 선택한 모둠 {id, name}
  games: Game[]; // 모둠의 게임(몬스터+퀴즈+위치) 목록
  eventMap: EventMap | null; // 행사장 지도(이미지 + 2점 앵커) — 지도 화면에서 사용
  playContext: PlayContext | null; // { eventId, groupId, mode }
  collection: CollectionEntry[]; // 도감 진행 상황
  groundLayout: GroundLayout | null; // 3D 지도(map3d)용 지면 world 좌표 캐시

  // ── 액션 ─────────────────────────────
  setMode: (mode: GameMode) => void;
  setGameData: (
    event: SchoolSearchResult,
    group: PlayGroup,
    games: Game[],
    eventMap: EventMap,
    playContext: PlayContext
  ) => void;
  // 학교(행사) + 모둠만 먼저 저장 (게임 목록은 이후 단계에서 채움)
  setSchoolAndGroup: (event: SchoolSearchResult, group: PlayGroup) => void;
  // 게임 목록만 교체/설정 (실행모드: 내 위치 주변 랜덤 몬스터를 클라이언트에서 구성해 넣을 때 사용).
  setGames: (games: Game[]) => void;
  // 퀴즈 결과 → 도감에 순차 기록(시도 순서 유지, 중복 무시). 성공/실패 여부(acquired)도 함께 저장.
  //   success=true → 포획 성공(몬스터 이미지). false → 포획 실패(도감에서 실패 이미지로 표시).
  recordResult: (monster: Monster, success: boolean) => void;
  // 몬스터 포획(성공) — recordResult(monster, true) 의 별칭(하위호환).
  capture: (monster: Monster) => void;
  // 3D 지도 진입 시 계산한 지면 world 좌표를 캐시로 저장.
  setGroundLayout: (layout: GroundLayout) => void;
  reset: () => void;
}

/**
 * 게임 전역 상태 저장소.
 * - persist 미들웨어로 localStorage("bookmon-game")에 자동 영속 → 앱 재시작/백그라운드 복귀에도 유지.
 * - reset()은 활동 종료 시 "세션 종료" 역할.
 */
export const useGameStore = create<GameState>()(
  persist(
    (set) => ({
      mode: null,
      event: null,
      group: null,
      games: [],
      eventMap: null,
      playContext: null,
      collection: [],
      groundLayout: null,

      setMode: (mode) => set({ mode }),

      setGameData: (event, group, games, eventMap, playContext) =>
        set({ event, group, games, eventMap, playContext }),

      setGames: (games) => set({ games }),

      setSchoolAndGroup: (event, group) =>
        set((state) => ({
          event,
          group,
          playContext: {
            eventId: event.id,
            groupId: group.id,
            mode: state.mode ?? "real",
          },
        })),

      recordResult: (monster, success) =>
        set((state) => {
          // 이미 기록된 몬스터면 무시(각 몬스터 1회만 — 중복 방지).
          if (state.collection.some((e) => e.monsterId === monster.id)) {
            return {};
          }
          // 시도 순서대로 뒤에 추가 → 도감이 좌상단부터 순차적으로 채워진다.
          // 성공/실패 모두 썸네일 저장(256→128→64 폴백) — 실패 칸도 해당 몬스터를
          // 회색처리+X 로 보여준다(CollectionLayer). null 이면 도감이 baked 폴백 표시.
          return {
            collection: [
              ...state.collection,
              {
                monsterId: monster.id,
                koreanName: monster.koreanName,
                imageUrl:
                  monster.thumbnail256Url ??
                  monster.thumbnail128Url ??
                  monster.thumbnail64Url ??
                  null,
                acquired: success,
                acquiredAt: new Date().toISOString(),
              },
            ],
          };
        }),

      capture: (monster) =>
        set((state) => {
          if (state.collection.some((e) => e.monsterId === monster.id)) return {};
          return {
            collection: [
              ...state.collection,
              {
                monsterId: monster.id,
                koreanName: monster.koreanName,
                imageUrl:
                  monster.thumbnail256Url ??
                  monster.thumbnail128Url ??
                  monster.thumbnail64Url ??
                  null,
                acquired: true,
                acquiredAt: new Date().toISOString(),
              },
            ],
          };
        }),

      setGroundLayout: (layout) => set({ groundLayout: layout }),

      reset: () =>
        set({
          mode: null,
          event: null,
          group: null,
          games: [],
          eventMap: null,
          playContext: null,
          collection: [],
          groundLayout: null,
        }),
    }),
    {
      name: GAME_STORAGE_KEY, // localStorage 키
      storage: createJSONStorage(() => localStorage),
    }
  )
);
