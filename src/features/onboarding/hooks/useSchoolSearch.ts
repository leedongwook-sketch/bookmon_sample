"use client";

import { useCallback, useState } from "react";
import type {
  SchoolSearchResult,
  PlayGroup,
  Game,
  EventMap,
  AsyncStatus,
} from "@/types";
import { schoolService } from "@/services/play/schoolService";

/**
 * 온보딩 play 데이터 훅 모음 (관련 기능 한 파일).
 * 모두 schoolService(Port)에만 의존 → mock/real 교체와 무관.
 * 추후 React Query로 바꾸려면 각 훅 내부만 교체하면 된다(호출부 불변).
 */

/** 학교 검색 (BM-102/103) */
export function useSchoolSearch() {
  const [status, setStatus] = useState<AsyncStatus>("idle");
  const [results, setResults] = useState<SchoolSearchResult[]>([]);

  const search = useCallback(async (keyword: string) => {
    setStatus("loading");
    try {
      const data = await schoolService.searchSchools(keyword);
      setResults(data);
      setStatus("success");
    } catch {
      setResults([]);
      setStatus("error");
    }
  }, []);

  const reset = useCallback(() => {
    setStatus("idle");
    setResults([]);
  }, []);

  return { status, results, search, reset };
}

/** 모둠 조회 (BM-104) */
export function useGroups() {
  const [status, setStatus] = useState<AsyncStatus>("idle");
  const [groups, setGroups] = useState<PlayGroup[]>([]);

  const fetchGroups = useCallback(async (eventId: string) => {
    setStatus("loading");
    try {
      const data = await schoolService.getGroups(eventId);
      setGroups(data);
      setStatus("success");
    } catch {
      setGroups([]);
      setStatus("error");
    }
  }, []);

  const reset = useCallback(() => {
    setStatus("idle");
    setGroups([]);
  }, []);

  return { status, groups, fetchGroups, reset };
}

/** 게임(몬스터+퀴즈+위치) 조회 (시작 시) */
export function useGames() {
  const [status, setStatus] = useState<AsyncStatus>("idle");
  const [games, setGames] = useState<Game[]>([]);

  // 조회 결과를 반환 → 호출부에서 바로 저장/이동에 사용 가능
  const fetchGames = useCallback(async (groupId: string): Promise<Game[] | null> => {
    setStatus("loading");
    try {
      const data = await schoolService.getGames(groupId);
      setGames(data);
      setStatus("success");
      return data;
    } catch {
      setGames([]);
      setStatus("error");
      return null;
    }
  }, []);

  return { status, games, fetchGames };
}

/** 행사장 지도(이미지 + 2점 앵커) 조회 (시작 시, 게임과 병렬) */
export function useEventMap() {
  const [status, setStatus] = useState<AsyncStatus>("idle");
  const [eventMap, setEventMap] = useState<EventMap | null>(null);

  const fetchEventMap = useCallback(
    async (eventId: string): Promise<EventMap | null> => {
      setStatus("loading");
      try {
        const data = await schoolService.getEventMap(eventId);
        setEventMap(data);
        setStatus("success");
        return data;
      } catch {
        setEventMap(null);
        setStatus("error");
        return null;
      }
    },
    []
  );

  return { status, eventMap, fetchEventMap };
}
