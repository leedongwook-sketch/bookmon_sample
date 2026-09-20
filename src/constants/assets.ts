// 이미지/에셋 레지스트리.
// 디자인 확정 전까지 모든 소스는 null → <AssetImage>가 플레이스홀더로 대체.
// 디자인이 나오면 "이 파일 한 곳"만 채우면 전체 화면에 반영된다.

// 온보딩 배경 — 단일 고정 이미지(main_bg.png → 1920px WebP 경량화, 원본 19MB→~250KB).
export const ONBOARDING_BACKGROUND = "/images/onboarding/main_bg.webp";

export interface AssetRegistry {
  logo: string | null; // BOOKMON 로고

  // 실행모드 버튼 — 라벨이 도형에 포함(baked)된 통PNG. 미선택/선택 상태별 이미지.
  btnModePractice: string; // 실행모드 미선택(크림+파란 테두리)
  btnModePracticeOn: string; // 실행모드 선택(파란 채움+흰 글자)
  btnModeEvent: string; // 행사모드 미선택(크림+주황 테두리)
  btnModeEventOn: string; // 행사모드 선택(주황 채움+흰 글자)

  // 온보딩 학교검색 UI (벡터).
  searchBar: string; // 검색바 프레임+돋보기(placeholder 텍스트는 제거 → 실제 input이 담당)
  btnFrame: string; // CTA 버튼 프레임(next_button.svg에서 글자 제거) — 라벨은 코드가 얹음

  // 다음 CTA 버튼 — 라벨 baked 통PNG(금색 pill). 기본/눌림(주황) 상태별.
  btnNext: string; // "다음" 기본(금색)
  btnNextPress: string; // "다음" 눌림(주황)

  // 모둠 번호 그리드(1~20) 프레임 PNG — 숫자는 코드가 위에 오버레이.
  groupNumIdle: string; // 미선택(크림+파란 테두리)
  groupNumSelected: string; // 선택(파란 그라데이션 채움)

  // 퀴즈 카드 배경 — 파란 하드커버 펼친 책 + 좌상단 "BOOK QUIZ" 리본이 baked된 빈 책 프레임.
  // 이미지 그대로 사용(원본 종횡비 유지). O/X·선택지·게이지는 CSS로 재현(PNG 아님).
  quizBookFrame: string;
}

export const ASSETS: AssetRegistry = {
  logo: "/images/main_logo_v2.png", // 새 BOOKMON 로고(트림+1280px, ~155KB). 파일명으로 캐시버스트(로고 교체 시 _v3 등)

  btnModePractice: "/images/onboarding/buttons/mode_practice.png",
  btnModePracticeOn: "/images/onboarding/buttons/mode_practice_on.png",
  btnModeEvent: "/images/onboarding/buttons/mode_event.png",
  btnModeEventOn: "/images/onboarding/buttons/mode_event_on.png",

  searchBar: "/images/searchbar_frame.svg",
  btnFrame: "/images/btn_frame.svg",

  btnNext: "/images/onboarding/buttons/btn_next.png",
  btnNextPress: "/images/onboarding/buttons/btn_next_press.png",

  groupNumIdle: "/images/onboarding/buttons/num_cell.png",
  groupNumSelected: "/images/onboarding/buttons/num_cell_on.png",

  quizBookFrame: "/images/quiz_frame.png",
};
