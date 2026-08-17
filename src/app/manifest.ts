import type { MetadataRoute } from "next";

// PWA 매니페스트 — "홈 화면에 추가" 시 주소창/툴바 없이 전체화면(standalone)으로 실행.
// Next가 자동으로 /manifest.webmanifest 를 만들고 <link rel="manifest">를 삽입한다.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "북몬 (BOOKMON)",
    short_name: "북몬",
    description: "책 속 북몬을 찾아라! — 위치기반 AR 독서 활동 게임",
    start_url: "/",
    display: "standalone", // 브라우저 UI 숨김(앱처럼)
    orientation: "landscape", // 가로모드 기본
    background_color: "#fff6e1", // 아이보리 (스플래시 배경)
    theme_color: "#12213a", // 네이비
    // TODO: 앱 아이콘(192/512 png) 확정 시 icons 추가 → 설치 배너/홈 아이콘 품질 향상.
  };
}
