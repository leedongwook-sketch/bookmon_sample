interface PillSelectListProps<T> {
  items: T[];
  getKey: (item: T) => string;
  getLabel: (item: T) => string;
  onSelect?: (item: T) => void;
  selectedKey?: string; // 단일 선택 강조용 (선택된 항목 key)
}

/**
 * 학교 이름 선택 목록 — **4열 고정 그리드 + 세로 스크롤**.
 * 버튼 디자인은 모둠 번호 버튼과 동일(피그마): 기본 크림 #FFF3DA + 파란 테두리 #366AB4 + 남색 글자,
 * 선택 시 gradient #30BDFF→#366AB4 + 흰 글자. 항목이 많아도 패널 폭 유지, 세로 스크롤.
 * (긴 학교명은 truncate + title 로 전체 노출.)
 */
export function PillSelectList<T>({
  items,
  getKey,
  getLabel,
  onSelect,
  selectedKey,
}: PillSelectListProps<T>) {
  // max-h 96 = 온보딩 패널 고정 본문 높이(OnboardingScaffold h-153 - pt19 - pb38)와 일치.
  // 1행(58+py16=74) 전부 + 2행째 12px가 살짝 보여 스크롤 가능함을 암시한다.
  return (
    <div className="max-h-[96px] w-full overflow-x-hidden overflow-y-auto px-1 py-2">
      <div className="grid grid-cols-2 gap-[10px]">
        {items.map((item, i) => {
          const selected = getKey(item) === selectedKey;
          // 홀수 개의 마지막 항목은 두 열에 걸쳐 가운데 정렬(좌측에 홀로 남지 않게).
          const lastOdd = items.length % 2 === 1 && i === items.length - 1;
          return (
            <button
              key={getKey(item)}
              type="button"
              title={getLabel(item)}
              aria-pressed={selected}
              onClick={() => onSelect?.(item)}
              className={`flex h-[58px] items-center justify-center rounded-[12px] border-[3px] border-[#366ab4] px-3 text-base font-extrabold leading-tight transition-all duration-100 active:translate-y-[1px] ${
                lastOdd
                  ? "col-span-2 mx-auto w-[calc(50%-5px)]"
                  : "w-full"
              } ${
                selected
                  ? "bg-gradient-to-b from-[#30bdff] to-[#366ab4] text-white"
                  : "bg-[#fff3da] text-[#124889]"
              }`}
            >
              <span className="block w-full truncate text-center">
                {getLabel(item)}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
