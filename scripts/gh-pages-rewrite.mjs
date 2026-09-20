// GitHub Pages(서브경로) 배포 전용 후처리.
//
// 정적 export 산출물(out/)에서, Next가 자동으로 basePath를 붙여주지 못하는
// "raw 에셋 경로"에 basePath 접두어를 주입한다.
//   - 대상: CSS background-image url(...), 2D 지도/도감 <img>, 3D useTexture, AR iframe,
//           mock 데이터에 박힌 /images·/ar 경로 등.
//   - 비대상(그대로 둠): next/image·<Link>·_next 정적자산은 Next가 이미 basePath를 적용함.
//
// 안전장치: 경로 앞이 따옴표(" ' `)나 여는 괄호(()로 시작하는 것만 치환한다.
//   (백틱 ` = 템플릿 리터럴 안에 인라인된 경로, 예: AR iframe `/ar/index.html?...`)
//   → 이미 /bookmon_sample/images/... 로 접두된 경로는 앞 글자가 'e'라 매치되지 않아 이중 접두 없음.
//
// 컴포넌트 소스는 전혀 손대지 않는다. 이 스크립트는 CI 빌드 산출물에만 작동한다.
//
// 사용: node scripts/gh-pages-rewrite.mjs <outDir> <basePath>
//   예: node scripts/gh-pages-rewrite.mjs out /bookmon_sample

import { readdirSync, statSync, readFileSync, writeFileSync } from "node:fs";
import { join, extname } from "node:path";

const [, , outDir, basePath] = process.argv;
if (!outDir || !basePath) {
  console.error("usage: node scripts/gh-pages-rewrite.mjs <outDir> <basePath>");
  process.exit(1);
}

// 텍스트 산출물만(소스맵 .map 은 제외 — 실행/서빙에 무관, 건드릴 이유 없음).
const TEXT_EXT = new Set([
  ".js",
  ".html",
  ".css",
  ".webmanifest",
  ".json",
  ".txt",
]);

// 따옴표/여는 괄호로 앵커링된 raw 경로만 접두.
const RULES = [
  [/(["'`(])\/images\//g, `$1${basePath}/images/`],
  [/(["'`(])\/ar\//g, `$1${basePath}/ar/`],
];

let changedFiles = 0;

function walk(dir) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) {
      walk(p);
    } else if (TEXT_EXT.has(extname(p))) {
      const before = readFileSync(p, "utf8");
      let after = before;
      for (const [re, rep] of RULES) after = after.replace(re, rep);
      if (after !== before) {
        writeFileSync(p, after);
        changedFiles += 1;
      }
    }
  }
}

walk(outDir);
console.log(`✓ raw 에셋 경로에 "${basePath}" 접두 완료 — 수정 파일 ${changedFiles}개`);
