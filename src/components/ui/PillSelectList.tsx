import { GameButton } from "./GameButton";

interface PillSelectListProps<T> {
  items: T[];
  getKey: (item: T) => string;
  getLabel: (item: T) => string;
  onSelect?: (item: T) => void;
  selectedKey?: string; // 단일 선택 강조용 (선택된 항목 key)
}

/**
 * 가로로 나란히(줄바꿈) 배치되는 게임풍 선택 버튼 목록.
 * 학교 선택(BM-103)·모둠 선택(BM-104)에서 공통 사용 → 온보딩 선택 UI 일관.
 */
export function PillSelectList<T>({
  items,
  getKey,
  getLabel,
  onSelect,
  selectedKey,
}: PillSelectListProps<T>) {
  return (
    <div className="flex max-w-[min(88vw,28rem)] flex-wrap items-center justify-center gap-4 py-1">
      {items.map((item) => (
        <GameButton
          key={getKey(item)}
          variant="cream"
          selected={getKey(item) === selectedKey}
          onClick={() => onSelect?.(item)}
          className="px-5 py-2.5 text-base"
        >
          {getLabel(item)}
        </GameButton>
      ))}
    </div>
  );
}
