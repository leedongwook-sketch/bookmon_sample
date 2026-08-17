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
  // 몬스터 포획 → 도감에 순차 추가(포획 순서 유지, 중복 무시). 이름·이미지도 함께 저장.
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

      capture: (monster) =>
        set((state) => {
          // 이미 포획한 몬스터면 무시(중복 방지).
          if (state.collection.some((e) => e.monsterId === monster.id)) {
            return {};
          }
          // 포획 순서대로 뒤에 추가 → 도감이 순차적으로 채워진다.
          // 이미지: 도감 카드용 썸네일(작은→큰 순 폴백). 없으면 null(이름 표시).
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
