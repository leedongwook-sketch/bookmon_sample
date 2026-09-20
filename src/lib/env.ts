// 실행 환경 설정 (데이터 소스 스왑의 단일 지점)

// 실서버 API 베이스 URL — **공통 도메인**. 모든 http 요청이 이 값을 앞에 붙인다.
// 기본값 = 운영 API(bookmon.vision-share.com). 필요 시 NEXT_PUBLIC_API_BASE_URL 로 오버라이드.
export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "https://bookmon.vision-share.com";

// 전체 mock(테스트) 모드 여부.
//   기본 false = 실서버 연동(단, 아직 미연동인 부분은 서비스 바인딩에서 개별 mock 유지 — schoolService.ts).
//   오프라인/전체 mock 이 필요하면 NEXT_PUBLIC_USE_MOCK=true 로 켠다.
export const USE_MOCK = process.env.NEXT_PUBLIC_USE_MOCK === "true";
