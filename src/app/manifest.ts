import type { MetadataRoute } from "next";

// 이 라우트는 정적이다(입력 없이 고정 JSON). 정적 export(output: "export") 시 필수 선언이며,
// 일반 빌드/dev 에는 영향이 없다(이미 정적이므로).
export const dynamic = "force-static";

// 배포 위치(서브경로) 반영 — 로컬은 env가 비어 "/", GitHub Pages 빌드에선 "/bookmon_sample/".
// start_url/scope 가 배포 경로와 어긋나면 홈 화면(PWA) 실행 시 루트로 진입해 404가 난다.
const basePath = process.env.NEXT_PUBLIC_BASE_PATH?.trim() || "";

// PWA 매니페스트 — "홈 화면에 추가" 시 주소창/툴바 없이 전체화면(standalone)으로 실행.
// Next가 자동으로 /manifest.webmanifest 를 만들고 <link rel="manifest">를 삽입한다.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "북몬 (BOOKMON)",
    short_name: "북몬",
    description: "책 속 북몬을 찾아라! — 위치기반 AR 독서 활동 게임",
    id: `${basePath}/`, // 설치 앱 식별자(배포 경로 기준)
    start_url: `${basePath}/`, // 홈 화면 실행 진입점 = 앱이 실제 서빙되는 경로
    scope: `${basePath}/`, // 이 경로 밖 이동은 브라우저로 — 앱 범위를 서브경로로 한정
    display: "standalone", // 브라우저 UI 숨김(앱처럼)
    orientation: "landscape", // 가로모드 기본
    background_color: "#fff6e1", // 아이보리 (스플래시 배경)
    theme_color: "#12213a", // 네이비
    // TODO: 앱 아이콘(192/512 png) 확정 시 icons 추가 → 설치 배너/홈 아이콘 품질 향상.
  };
}
