import type { NextConfig } from "next";

// ── GitHub Pages(서브경로) 배포 전용 스위치 ─────────────────────────────
// 평소 dev/build 에서는 NEXT_PUBLIC_BASE_PATH 가 비어 있어 아무 영향이 없다(로컬 동작 불변).
// 배포 워크플로우에서만 NEXT_PUBLIC_BASE_PATH=/bookmon_sample 를 주입해
// 정적 export + basePath + 이미지 비최적화로 빌드한다.
// raw 에셋 경로(/images, /ar)는 빌드 후 scripts/gh-pages-rewrite.mjs 가 접두어를 주입한다
// (컴포넌트 소스는 손대지 않는다).
const basePath = process.env.NEXT_PUBLIC_BASE_PATH?.trim() || "";
const isPagesBuild = basePath.length > 0;

const nextConfig: NextConfig = {
  // 개발 중 휴대기기(LAN) 접속 허용 — Next 16이 기본 차단하는 dev 리소스(HMR 등) 교차출처 허용.
  allowedDevOrigins: ["192.168.45.125"],
  ...(isPagesBuild
    ? {
        output: "export" as const, // out/ 정적 산출물
        basePath, // /bookmon_sample — 라우팅·_next·next/image 자동 접두
        trailingSlash: true, // /map → /map/index.html (정적 호스팅 라우팅)
        images: { unoptimized: true }, // export 는 이미지 최적화 서버가 없음
      }
    : {}),
};

export default nextConfig;
