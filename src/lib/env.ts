// 실행 환경 설정 (데이터 소스 스왑의 단일 지점)

// 실서버 API 베이스 URL. mock 사용 중에는 비어 있어도 됨.
export const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "";

// mock 데이터 사용 여부.
// 서버 미구축 상태이므로 기본 mock=on. 실서버 준비되면 NEXT_PUBLIC_USE_MOCK=false 로 전환.
export const USE_MOCK = process.env.NEXT_PUBLIC_USE_MOCK !== "false";
