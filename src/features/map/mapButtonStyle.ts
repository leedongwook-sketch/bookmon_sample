// 지도 화면 상단 코너 버튼(햄버거/3D·2D 토글) 공통 디자인 — 심플.
// 흰 면 + 검은 테두리 + 검은 글자/아이콘. 눌림 시 살짝 눌러앉음.
// 아이콘/텍스트 버튼 모두 이 클래스를 붙이고 크기/패딩만 개별 지정한다.
export const MAP_GOLD_BUTTON = [
  "border-2 border-black bg-white text-black",
  "shadow-[0_2px_4px_rgba(0,0,0,0.2)]",
  "transition-all duration-100",
  "active:translate-y-[1px] active:bg-[#f2f2f2]",
].join(" ");
