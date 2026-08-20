// 이미지/에셋 레지스트리.
// 디자인 확정 전까지 모든 소스는 null → <AssetImage>가 플레이스홀더로 대체.
// 디자인이 나오면 "이 파일 한 곳"만 채우면 전체 화면에 반영된다.

// 온보딩 배경 후보(온보딩 화면 전용) — 진입할 때마다 이 중 하나를 랜덤으로 표시.
// bookmon_design/기본배경/bg1~6.png 를 WebP로 경량화 임포트한 것.
export const ONBOARDING_BACKGROUNDS = [
  "/images/onboarding/bg1.webp",
  "/images/onboarding/bg2.webp",
  "/images/onboarding/bg3.webp",
  "/images/onboarding/bg4.webp",
  "/images/onboarding/bg5.webp",
  "/images/onboarding/bg6.webp",
] as const;

// 온보딩 배경 하나를 랜덤 선택. 클라이언트 이벤트/마운트 시점에 1회 호출해 세션 내 고정한다
// (렌더마다 호출하면 배경이 깜빡이므로 useState 초기화 등으로 한 번만 뽑을 것).
export function pickOnboardingBackground(): string {
  return ONBOARDING_BACKGROUNDS[
    Math.floor(Math.random() * ONBOARDING_BACKGROUNDS.length)
  ];
}

export interface AssetRegistry {
  logo: string | null; // BOOKMON 로고

  // 실행모드 버튼 — 벡터(SVG). 라벨이 도형에 포함(baked), 확대해도 안 깨짐.
  btnModePractice: string; // 체험모드(스카이블루)
  btnModeEvent: string; // 행사모드(골드)

  // 온보딩 학교검색 UI (벡터).
  searchBar: string; // 검색바 프레임+돋보기(placeholder 텍스트는 제거 → 실제 input이 담당)
  btnFrame: string; // CTA 버튼 프레임(next_button.svg에서 글자 제거) — 라벨은 코드가 얹음

  // 모둠 번호 그리드(1~20) 스프라이트 — 칸별로 CSS 스프라이트로 잘라 씀.
  groupNumIdle: string; // 미선택(크림+네이비 숫자)
  groupNumSelected: string; // 선택(스카이블루+흰 숫자)

  // 퀴즈 답 버튼 — quiz_button.svg에서 baked 텍스트·점선 제거 후 버튼별로 추출(줄무늬 광택 텍스처 포함).
  // 텍스처가 라스터라 고해상 PNG로 추출. 라벨은 코드가 얹음. 선택지 홀/짝으로 교대 사용.
  quizBtnBlue: string; // 파랑
  quizBtnGold: string; // 골드
  // 퀴즈 카드 배경 — quiz_frame.svg의 빈 책 프레임(image0, 리본·안내선 포함, 예시 텍스트 없음).
  quizBookFrame: string;
}

export const ASSETS: AssetRegistry = {
  logo: "/images/main_logo.webp", // 마스터 캐릭터 + BOOKMON 로고(원본 4.9MB SVG→래스터 WebP 경량화, 1024px 알파)

  btnModePractice: "/images/btn_mode_practice.svg",
  btnModeEvent: "/images/btn_mode_event.svg",

  searchBar: "/images/searchbar_frame.svg",
  btnFrame: "/images/btn_frame.svg",

  groupNumIdle: "/images/group_num_noselect.svg",
  groupNumSelected: "/images/group_num_select.svg",

  quizBtnBlue: "/images/quiz_btn_blue.png",
  quizBtnGold: "/images/quiz_btn_gold.png",
  quizBookFrame: "/images/quiz_book_frame.png",
};
