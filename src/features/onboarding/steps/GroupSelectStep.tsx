"use client";

import { GroupNumberGrid } from "../components/GroupNumberGrid";
import { Notice } from "./Notice";
import type { PlayGroup } from "@/types";
import type { useOnboardingFlow } from "../hooks/useOnboardingFlow";

type Flow = ReturnType<typeof useOnboardingFlow>;

interface GroupSelectStepProps {
  group: Flow["group"]; // 모둠 조회 상태(status/groups)
  selectedGroup: PlayGroup | null;
  onSelectGroup: (group: PlayGroup) => void;
  startError: boolean; // 게임/지도 조회 실패
}

/**
 * 모둠 선택 단계 (BM-104) — 패널 본문만.
 * 공통 골격/뒤로 버튼/"시작" 버튼은 OnboardingFlow가 스캐폴드로 감싼다.
 * 20칸 번호 그리드에서 모둠을 고른다.
 */
export function GroupSelectStep({
  group,
  selectedGroup,
  onSelectGroup,
  startError,
}: GroupSelectStepProps) {
  return (
    <div className="flex flex-col items-center gap-4">
      {group.status === "loading" && <Notice>불러오는 중…</Notice>}
      {group.status === "error" && (
        <Notice>연결이 불안정합니다. 다시 시도해 주세요.</Notice>
      )}
      {group.status === "success" && group.groups.length === 0 && (
        <Notice>등록된 모둠이 없습니다.</Notice>
      )}
      {group.status === "success" && group.groups.length > 0 && (
        <GroupNumberGrid
          groups={group.groups}
          selectedKey={selectedGroup?.id}
          onSelect={onSelectGroup}
        />
      )}
      {startError && (
        <Notice>게임 정보를 불러오지 못했어요. 다시 시도해 주세요.</Notice>
      )}
    </div>
  );
}
