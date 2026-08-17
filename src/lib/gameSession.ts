import type {
  SchoolSearchResult,
  PlayGroup,
  Game,
  PlayContext,
  CollectionEntry,
  GameMode,
} from "@/types";
import { GAME_STORAGE_KEY } from "@/constants/storage";

// localStorage에 저장되는 게임 상태의 데이터 부분 (gameStore와 동일 구조)
export interface SavedGameState {
  mode: GameMode | null;
  event: SchoolSearchResult | null;
  group: PlayGroup | null;
  games: Game[];
  playContext: PlayContext | null;
  collection: CollectionEntry[];
}

/**
 * localStorage("bookmon-game")를 읽어 저장된 게임 상태를 반환.
 * zustand persist 래퍼({ state, version })와 순수 객체 둘 다 지원.
 * 키가 없거나 JSON 파싱 실패 시 null.
 */
export function readSavedGameState(): unknown | null {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(GAME_STORAGE_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" && "state" in parsed
      ? (parsed as { state: unknown }).state
      : parsed;
  } catch {
    return null;
  }
}

/** 손상 데이터 정리 */
export function clearSavedGameState(): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(GAME_STORAGE_KEY);
}

/** GameState 구조 검증 (필드 존재 + 기본 타입) */
export function isValidGameState(v: unknown): v is SavedGameState {
  if (!v || typeof v !== "object") return false;
  const s = v as Record<string, unknown>;
  const modeOk =
    s.mode === null || s.mode === "practice" || s.mode === "real";
  return (
    modeOk &&
    "event" in s &&
    "group" in s &&
    "playContext" in s &&
    Array.isArray(s.games) &&
    Array.isArray(s.collection)
  );
}

/**
 * "정상(플레이 가능) 데이터" 판정 — map으로 보낼 조건.
 * 구조가 유효하면서 행사·모둠·게임데이터가 실제로 채워져 있어야 함.
 * (모드만 고른 미완 상태는 false → 모드선택으로 남김)
 */
export function isPlayableGameState(
  v: unknown
): v is SavedGameState & {
  event: SchoolSearchResult;
  group: PlayGroup;
  playContext: PlayContext;
} {
  if (!isValidGameState(v)) return false;
  const s = v as SavedGameState;

  const event = s.event;
  const group = s.group;
  const pc = s.playContext;
  if (!event || typeof event !== "object") return false;
  if (!group || typeof group !== "object") return false;
  if (!pc || typeof pc !== "object") return false;

  const eventOk = typeof event.id === "string" && event.id.length > 0;
  const groupOk = typeof group.id === "string" && group.id.length > 0;
  const pcOk =
    typeof pc.eventId === "string" &&
    pc.eventId.length > 0 &&
    typeof pc.groupId === "string" &&
    pc.groupId.length > 0 &&
    (pc.mode === "practice" || pc.mode === "real");

  return eventOk && groupOk && pcOk && Array.isArray(s.games);
}
