#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────
# 8thwall AR 번들 → 본 앱(public/ar) 재임포트 스크립트
#
# 8thwall 프로젝트(bookmon_ar)를 빌드하고 그 산출물(dist/)을 이 앱의
# public/ar/ 로 복사(재임포트)한다. 8thwall 쪽이 수정될 때마다 이 스크립트를
# 돌린 뒤 본 앱을 빌드하면 최신 AR이 반영된다.
#
# 사용:  bash scripts/sync-ar.sh            # 8thwall 빌드 + 재임포트
#        AR_SRC=/다른/경로 bash scripts/...  # 8thwall 경로 오버라이드
#
# 이후 본 앱 빌드:  npm run build   (또는 npm run build:ar 로 한 번에 — package.json 참고)
# ─────────────────────────────────────────────────────────────
set -euo pipefail

# 8thwall 프로젝트 경로(공백 포함). 필요 시 환경변수로 오버라이드.
AR_SRC="${AR_SRC:-/Users/dongwooklee/Documents/8th Wall/bookmon_ar}"
# 본 앱 public/ar 목적지 (이 스크립트 기준 상대).
DEST="$(cd "$(dirname "$0")/.." && pwd)/public/ar"

echo "▶ 8thwall 경로: $AR_SRC"
echo "▶ 재임포트 대상: $DEST"

if [ ! -d "$AR_SRC" ]; then
  echo "✗ 8thwall 프로젝트를 찾을 수 없습니다: $AR_SRC" >&2
  exit 1
fi

# 1) 8thwall 변경사항 반영해 빌드
echo "▶ [1/2] 8thwall 빌드 (npm install && npm run build)…"
( cd "$AR_SRC" && npm install && npm run build )

if [ ! -f "$AR_SRC/dist/index.html" ]; then
  echo "✗ 빌드 산출물(dist/index.html)이 없습니다. 8thwall 빌드 로그를 확인하세요." >&2
  exit 1
fi

# 2) dist/ → public/ar/ 재임포트.
#    --delete: 삭제된 파일도 반영(정확한 미러). --exclude 'ar/': 중첩된 ar/ 라우트 폴더는 불필요.
echo "▶ [2/2] dist → public/ar 복사…"
mkdir -p "$DEST"
rsync -a --delete --exclude 'ar/' "$AR_SRC/dist/" "$DEST/"

echo "✓ AR 재임포트 완료. 이제 본 앱을 빌드하세요:  npm run build"
