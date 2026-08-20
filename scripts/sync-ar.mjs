#!/usr/bin/env node
// ─────────────────────────────────────────────────────────────
// 8thwall AR 번들 → 본 앱(public/ar/shooting) 재임포트 (크로스플랫폼: mac/Windows)
//
// 8thwall 프로젝트(bookmon_ar)를 빌드하고 그 산출물(dist/)을 이 앱의
// public/ar/shooting/ 로 미러 복사한다. C안 통합에서 AR은 /ar/shooting/ 로 전체 페이지
// 이동해 실행되므로 목적지가 하위 shooting/ 이다(스텁/구버전 index.html을 덮어씀).
//
// 전제: 두 프로젝트를 git에서 받아 **같은 상위 폴더에 형제로** 둔다.
//   <공통폴더>/bookmon_front   (이 프로젝트)
//   <공통폴더>/bookmon_ar      (8thwall AR — 자동 탐색 대상)
//
// 사용:
//   npm run sync-ar                      # 형제 폴더 자동 탐색 + 빌드 + 재임포트
//   AR_SRC=/경로/bookmon_ar npm run sync-ar   # 경로 직접 지정(공백 포함 OK)
//   (Windows PowerShell)  $env:AR_SRC="D:\path\bookmon_ar"; npm run sync-ar
//   (Windows cmd)         set AR_SRC=D:\path\bookmon_ar&& npm run sync-ar
//
// 이후 본 앱 빌드:  npm run build   (또는 npm run build:ar 로 한 번에)
// ─────────────────────────────────────────────────────────────
import { existsSync, rmSync, mkdirSync, cpSync } from "node:fs";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { execSync } from "node:child_process";

const FRONT_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const PARENT = resolve(FRONT_ROOT, ".."); // 두 프로젝트의 공통 상위 폴더

// AR 프로젝트 경로 결정: 1) 환경변수 AR_SRC 우선 → 2) 형제 폴더 후보 자동 탐색.
const CANDIDATES = ["bookmon_ar", "bookmon-ar", "bookmon_ar_8thwall", "8thwall_bookmon"];
function resolveArSrc() {
  if (process.env.AR_SRC) return resolve(process.env.AR_SRC);
  for (const name of CANDIDATES) {
    const p = join(PARENT, name);
    if (existsSync(join(p, "package.json"))) return p;
  }
  return join(PARENT, "bookmon_ar"); // 기본값(없으면 아래에서 안내)
}

const AR_SRC = resolveArSrc();
const DEST = join(FRONT_ROOT, "public", "ar", "shooting");
const DIST = join(AR_SRC, "dist");

console.log("▶ 8thwall 경로 :", AR_SRC);
console.log("▶ 재임포트 대상:", DEST);

if (!existsSync(AR_SRC)) {
  console.error(
    `✗ AR 프로젝트를 찾지 못했습니다: ${AR_SRC}\n` +
      `  형제 폴더(${CANDIDATES.join(", ")})가 없으면 AR_SRC 로 경로를 지정하세요.\n` +
      `  예) AR_SRC="/경로/bookmon_ar" npm run sync-ar`
  );
  process.exit(1);
}

// 1) 8thwall 빌드 (npm install + build). execSync는 OS 기본 셸로 실행 → mac/win 공통.
console.log("▶ [1/2] 8thwall 빌드 (npm install && npm run build)…");
execSync("npm install && npm run build", { cwd: AR_SRC, stdio: "inherit" });

if (!existsSync(join(DIST, "index.html"))) {
  console.error(`✗ 빌드 산출물이 없습니다: ${join(DIST, "index.html")}\n  8thwall 빌드 로그를 확인하세요.`);
  process.exit(1);
}

// 2) dist → public/ar/shooting 미러 복사(기존 제거 후 복사 = rsync --delete 대체).
//    중첩된 ar/ 디렉터리는 제외(불필요한 라우트 폴더).
console.log("▶ [2/2] dist → public/ar/shooting 복사…");
rmSync(DEST, { recursive: true, force: true });
mkdirSync(DEST, { recursive: true });
cpSync(DIST, DEST, {
  recursive: true,
  filter: (src) => {
    const rel = src.slice(DIST.length).split("\\").join("/"); // Windows 역슬래시 정규화
    return rel !== "/ar" && !rel.startsWith("/ar/");
  },
});

console.log("✓ AR 재임포트 완료. 이제 본 앱을 빌드하세요:  npm run build");
