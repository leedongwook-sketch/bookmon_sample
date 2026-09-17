"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  useSchoolSearch,
  useGroups,
  useGames,
  useEventMap,
} from "./useSchoolSearch";
import { useGameStore } from "@/store/gameStore";
import type { SchoolSearchResult, PlayGroup, Game } from "@/types";

// 게임 목록을 startpoint(1-based 핀 번호) 기준으로 순환 정렬한다.
//   예: startpoint=3 → [g3, g4, …, g_last, g1, g2]. 범위를 벗어나면 1로 폴백.
function rotateByStartpoint(games: Game[], startpoint: number): Game[] {
  if (games.length === 0) return games;
  const n = games.length;
  const start = Number.isFinite(startpoint)
    ? ((Math.round(startpoint) - 1) % n + n) % n // 1-based → 0-based, 안전 wrap
    : 0;
  if (start === 0) return games;
  return [...games.slice(start), ...games.slice(0, start)];
}

/**
 * 실전모드 온보딩 흐름의 상태·로직을 한곳에 모은 훅 (BM-102 → BM-103 → BM-104).
 * data 훅 4개(검색/모둠/게임/지도) 호출과 4개 핸들러·단계 판별을 담아
 * OnboardingFlow(뷰)는 "어느 단계를 그릴지"만 결정하도록 얇게 유지한다.
 *
 * data 소스는 schoolService(Port)에만 의존 → mock/real 교체와 무관.
 */
export function useOnboardingFlow() {
  const router = useRouter();
  const setSchoolAndGroup = useGameStore((s) => s.setSchoolAndGroup);
  const setGameData = useGameStore((s) => s.setGameData);
  const mode = useGameStore((s) => s.mode);

  // ── 사용자 입력/선택 상태 ─────────────────────
  const [keyword, setKeyword] = useState("");
  // pendingSchool: 목록에서 클릭해 **하이라이트만** 된 학교(아직 확정 X). "다음" 눌러야 확정.
  const [pendingSchool, setPendingSchool] =
    useState<SchoolSearchResult | null>(null);
  const [selectedSchool, setSelectedSchool] =
    useState<SchoolSearchResult | null>(null);
  const [selectedGroup, setSelectedGroup] = useState<PlayGroup | null>(null);

  // ── play 데이터 훅 (Port 경유) ────────────────
  const school = useSchoolSearch(); // 학교 검색
  const group = useGroups(); // 모둠 조회
  const games = useGames(); // 게임(몬스터+퀴즈) 조회 — 시작 시
  const eventMap = useEventMap(); // 행사장 지도 조회 — 시작 시(게임과 병렬)

  // 시작 조회 = 게임 + 지도 병렬. 둘 중 하나라도 진행/실패면 그 상태로 취급.
  const starting = games.status === "loading" || eventMap.status === "loading";
  const startError = games.status === "error" || eventMap.status === "error";

  // ── 이벤트 핸들러 ─────────────────────────────
  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (school.status === "loading") return; // 검색 중 중복 요청 차단
    school.search(keyword); // 다음 버튼은 항상 활성 — 입력값 그대로 검색
  };

  // 목록 클릭 = 하이라이트(선택 대기)만. 확정/이동은 "다음"에서.
  const handlePickSchool = (s: SchoolSearchResult) => setPendingSchool(s);

  // "다음" = pending 학교 확정 → 모둠 조회 → (selectedSchool 세팅으로) 모둠 선택 단계로 이동.
  const handleConfirmSchool = () => {
    if (!pendingSchool) return; // 미선택 시 무시
    setSelectedSchool(pendingSchool);
    setSelectedGroup(null);
    group.fetchGroups(pendingSchool.id);
  };

  // 학교 선택 → 학교 입력(뒤로 코너 버튼): 검색 결과 비우고 하이라이트 초기화.
  const handleBackToInput = () => {
    school.reset();
    setPendingSchool(null);
  };

  const handleSelectGroup = (g: PlayGroup) => {
    setSelectedGroup(g); // 단일 선택
    if (selectedSchool) {
      setSchoolAndGroup(selectedSchool, g); // gameStore에 학교+모둠 저장
    }
  };

  // BM-104(모둠 선택) → BM-103(학교 선택)으로 되돌리기.
  // selectedSchool을 비우면 schoolSelecting(검색 결과 유지)이 참이라 학교 선택 단계가 다시 노출된다.
  const handleBackToSchoolSelect = () => {
    setPendingSchool(selectedSchool); // 이전 확정 학교를 하이라이트로 유지
    setSelectedSchool(null);
    setSelectedGroup(null);
  };

  const handleStart = async () => {
    if (!selectedSchool || !selectedGroup || starting) return;
    // 게임(GET /play/groups/{groupId}/games) + 지도(GET /play/events/{eventId}/map) 병렬 조회
    const [data, map] = await Promise.all([
      games.fetchGames(selectedGroup.id),
      eventMap.fetchEventMap(selectedSchool.id),
    ]);
    if (!data || !map) return; // 하나라도 실패 시 에러 안내 유지
    // 게임은 행사 단위 공유 목록(등록순). 모둠의 startpoint(1-based) 핀부터 시작하도록 순환 정렬.
    const ordered = rotateByStartpoint(data, selectedGroup.startpoint);
    setGameData(selectedSchool, selectedGroup, ordered, map, {
      eventId: selectedSchool.id,
      groupId: selectedGroup.id,
      mode: mode ?? "real",
    });
    router.push("/map3d"); // 3D 지도가 기본 진입(2D는 /map, 지도 내 버튼으로 이동)
  };

  // ── 단계 판별 ────────────────────────────────
  // 학교를 확정하면 모둠 선택, 검색 결과가 있으면 학교 선택, 그 외 학교 입력.
  const schoolSelecting =
    school.status === "success" && school.results.length > 0;

  return {
    // 입력 상태
    keyword,
    setKeyword,
    pendingSchool,
    selectedSchool,
    selectedGroup,
    // 데이터 훅
    school,
    group,
    games,
    eventMap,
    // 파생 상태
    starting,
    startError,
    schoolSelecting,
    // 핸들러
    handleSearch,
    handlePickSchool,
    handleConfirmSchool,
    handleBackToInput,
    handleSelectGroup,
    handleBackToSchoolSelect,
    handleStart,
  };
}
