"use client";

import { OnboardingScaffold } from "../components/OnboardingScaffold";
import { CtaButton } from "../components/CtaButton";
import { GroupNumberGrid } from "../components/GroupNumberGrid";
import { Notice } from "./Notice";
import type { PlayGroup } from "@/types";
import type { useOnboardingFlow } from "../hooks/useOnboardingFlow";

type Flow = ReturnType<typeof useOnboardingFlow>;

interface GroupSelectStepProps {
  group: Flow["group"]; // 모둠 조회 상태(status/groups)
  selectedGroup: PlayGroup | null;
  onSelectGroup: (group: PlayGroup) => void;
  starting: boolean; // 게임+지도 병렬 로딩 중
  startError: boolean; // 게임/지도 조회 실패
  onStart: () => void;
  onBack: () => void; // 좌상단 뒤로 → 학교 선택(BM-103)
}

/**
 * 모둠 선택 단계 (BM-104).
 * 20칸 번호 그리드에서 모둠을 고르고 "시작"으로 게임+지도를 로드해 /map으로 이동한다.
 */
export function GroupSelectStep({
  group,
  selectedGroup,
  onSelectGroup,
  starting,
  startError,
  onStart,
  onBack,
}: GroupSelectStepProps) {
  return (
    <OnboardingScaffold
      banner="모둠 번호를 선택해 주세요"
      onBack={onBack}
      // 시작 버튼도 동일 CtaButton + 하단 걸침. 항상 활성 표시(딤 X) — 미선택 클릭은 onStart가 무시.
      footer={
        <CtaButton onClick={onStart}>
          {starting ? "불러오는 중…" : "시작"}
        </CtaButton>
      }
    >
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
    </OnboardingScaffold>
  );
}
