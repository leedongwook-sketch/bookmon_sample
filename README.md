# 북몬 (BOOKMON) — 프론트엔드

책 속 몬스터를 찾아라! 위치기반 AR 독서 활동 게임의 프론트엔드.

- 온보딩(모드/학교/모둠 선택) → 지도(2D/3D) → 몬스터 발견 → AR 체험 → 도감

---

## 기술 스택 / 빌드 구성

| 구분 | 사용 | 비고 |
|---|---|---|
| 프레임워크 | **Next.js 16** (App Router, Turbopack) | 정적 export로 GitHub Pages 배포 |
| 언어 | **TypeScript 5** | |
| 스타일 | **Tailwind CSS v4** (`@tailwindcss/postcss`) | 디자인 토큰은 `globals.css` |
| 3D 지도 | **three 0.182 + @react-three/fiber 9 + drei 10** | `/map3d`. three는 0.182 고정(0.183+ Clock deprecate 경고 회피) |
| 상태 | **zustand 5** (persist → localStorage `bookmon-game`) | |
| AR | 별도 **8thwall** 프로젝트 빌드를 `public/ar/shooting/`에 임포트 | 아래 "AR 빌드·임포트" |

> ⚠️ 이 저장소의 Next는 기본값이 다를 수 있습니다. 코드 작성 전 `node_modules/next/dist/docs/` 참고(AGENTS.md).

### 요구 사항
- **Node.js 20 이상** (CI는 Node 20, 로컬 22 확인)
- npm (lockfile 기준 `npm ci` 권장)

---

## 설치

```bash
git clone <이 저장소>
cd bookmon_front
npm install        # 또는 npm ci
```

---

## 로컬 개발

### 기본 (HTTP)
```bash
npm run dev
```
→ http://localhost:3000

### 같은 Wi-Fi의 휴대폰에서 접속 (LAN)
```bash
npm run dev -- -H 0.0.0.0
```
→ 휴대폰에서 `http://<PC_LAN_IP>:3000` (예: `http://192.168.0.10:3000`)

### 카메라/모션이 필요한 경우 (실제 AR) — HTTPS 필수
카메라·모션 권한 API는 **보안 컨텍스트(HTTPS/localhost)** 에서만 동작합니다. LAN HTTP로는 카메라가 안 뜹니다.
```bash
npm run dev -- --experimental-https -H 0.0.0.0
```
→ `https://<PC_LAN_IP>:3000` (자체서명 인증서 경고는 "고급 → 계속"으로 통과)

> 로컬 dev는 서브경로(basePath) 없이 루트(`/`)에서 서빙됩니다. basePath는 배포 시에만 적용(아래).

---

## 프로덕션 빌드

```bash
npm run build     # next build
npm run start     # 빌드 결과 실행(Node 서버)
```

---

## AR (8thwall) 빌드·임포트

AR 체험은 **별도 8thwall 프로젝트(`bookmon_ar`)** 를 빌드해 정적 번들로 이 앱의 `public/ar/shooting/`에 임포트합니다. 앱은 `/ar/shooting/index.html`로 **전체 페이지 이동**해 AR을 실행하고, `sessionStorage` 계약(`bookmon-ar-req`/`bookmon-ar-res`)으로 통신합니다.

> ⚠️ **`public/ar/` 는 저장소에 커밋되지 않는 생성물입니다.** 새로 clone하면 AR 번들이 없으니,
> 아래처럼 `bookmon_ar`를 **형제 폴더로 받아 `npm run build:ar`** 를 실행해야 AR이 동작합니다.
> (AR 없이 온보딩·지도만 볼 거면 생략 가능 — 몬스터 클릭 시 AR 페이지만 404)

### 폴더 배치 (권장 — 형제 폴더)
두 프로젝트를 **같은 상위 폴더**에 두면 스크립트가 자동으로 찾습니다.
```
<공통폴더>/
├─ bookmon_front/   ← 이 프로젝트
└─ bookmon_ar/      ← 8thwall AR (자동 탐색: bookmon_ar, bookmon-ar 등)
```

### 한 방에 (권장) — mac / Windows 공통
```bash
npm run build:ar
```
= `sync-ar`(8thwall 빌드 + `public/ar/shooting/` 미러 임포트) + 본 앱 `build`.
크로스플랫폼 Node 스크립트(`scripts/sync-ar.mjs`)라 mac·Windows 모두 동작합니다(rsync/bash 불필요).

### AR 프로젝트 경로가 형제가 아닐 때 — `AR_SRC` 지정
```bash
# mac / Git Bash
AR_SRC="/경로/bookmon_ar" npm run build:ar

# Windows PowerShell
$env:AR_SRC="D:\경로\bookmon_ar"; npm run build:ar

# Windows cmd
set AR_SRC=D:\경로\bookmon_ar&& npm run build:ar
```

### 8thwall 빌드 필수조건
- webpack `output.publicPath` = **`''` 또는 `'auto'`** (❌ `'/'`) — 서브경로/basePath에서 `bundle.js`·`assets`·`external` 로드에 필수(상대경로).
- 실기 카메라 검증은 **HTTPS**(위 dev HTTPS 또는 배포)에서만.

> 임포트하면 개발용 스텁(`public/ar/shooting/index.html`)이 실제 8thwall 번들로 덮어써집니다. 계약이 동일해 본 앱 코드 변경은 없습니다.

---

## GitHub Pages 배포

로컬 소스는 그대로 두고 **배포(CI) 시점에만** 정적 export + basePath가 적용되도록 구성돼 있습니다.

### 동작 방식
- `next.config.ts` — `NEXT_PUBLIC_BASE_PATH` 가 설정된 빌드에서만 `output:"export"` + `basePath` + `trailingSlash` + `images.unoptimized` 활성화. **로컬 dev/build는 영향 없음.**
- `scripts/gh-pages-rewrite.mjs` — export 산출물(`out/`)에서 Next가 자동 접두 못 하는 raw 경로(`/images`, `/ar`)에 basePath 주입.
- `.github/workflows/deploy.yml` — `main` push 시: `npm ci` → Pages 활성화 → `NEXT_PUBLIC_BASE_PATH=/bookmon_sample` 로 build → 경로 후처리 → 배포.
  - 저장소명이 바뀌면 워크플로우의 `BASE_PATH` 값만 수정.

### 최초 1회 설정 (필수, 수동)
저장소 **Settings → Pages → Build and deployment → Source = `GitHub Actions`** 로 지정.
(❌ "Deploy from a branch" 를 고르면 README가 대신 뜹니다.)

### 배포 트리거
```bash
git push origin main      # 워크플로우 자동 실행
```
완료 후: `https://<user>.github.io/<repo>/` (현재: `https://leedongwook-sketch.github.io/bookmon_sample/`)

### 로컬에서 배포본 미리 확인 (선택)
```bash
NEXT_PUBLIC_BASE_PATH=/bookmon_sample npm run build   # out/ 생성
node scripts/gh-pages-rewrite.mjs out /bookmon_sample # 경로 접두
# out/ 을 정적 서버로 서빙해 확인
```

---

## npm 스크립트

| 스크립트 | 설명 |
|---|---|
| `npm run dev` | 개발 서버(HTTP). `-- -H 0.0.0.0`(LAN), `-- --experimental-https`(카메라) 옵션 |
| `npm run build` | 프로덕션 빌드 |
| `npm run start` | 빌드 결과 실행 |
| `npm run lint` | ESLint |
| `npm run sync-ar` | 8thwall 빌드 + `public/ar/shooting/` 임포트 (크로스플랫폼) |
| `npm run build:ar` | `sync-ar` + 본 앱 `build` 한 번에 |

---

## 프로젝트 구조 (요약)

```
src/
├─ app/              # 라우트: / (온보딩), /map (2D), /map3d (3D), manifest
├─ features/
│  ├─ onboarding/    # 모드/학교/모둠 선택 (OnboardingFlow)
│  ├─ map/           # 2D 지도, 조우 흐름(useEncounterFlow), AR 브리지(arBridge)
│  ├─ map3d/         # 3D 지도 (react-three-fiber)
│  ├─ quiz/ collection/  # 퀴즈·도감 레이어
├─ store/            # zustand gameStore (persist)
├─ services/         # 데이터 소스(Port + mock/http)
├─ lib/ hooks/ components/ constants/
public/
├─ images/           # 지도·UI 에셋(WebP/SVG)
└─ ar/shooting/      # 8thwall AR 번들(임포트 대상). 기본은 개발용 스텁
scripts/
├─ sync-ar.mjs           # 8thwall 임포트(크로스플랫폼)
└─ gh-pages-rewrite.mjs  # 배포용 경로 후처리
```

---

## 참고 / 트러블슈팅
- **카메라/모션이 안 뜸** → HTTPS(또는 localhost)인지 확인. LAN HTTP는 불가.
- **배포 후 README만 보임** → Pages Source가 "GitHub Actions"인지 확인.
- **배포 후 이미지/AR 404** → 8thwall `publicPath`가 상대(`''`/`auto`)인지, `BASE_PATH`가 저장소명과 일치하는지 확인.
- **three Clock deprecation 경고** → three는 0.182 고정(임의 업그레이드 금지).
