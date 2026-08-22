// AR 통합 C안 — 본 앱 ↔ AR(`/ar/shooting/`) 핸드셰이크 브리지 (순수 헬퍼).
//
// 두 앱은 서로의 내부(스토어/컴포넌트)를 모른 채 아래 sessionStorage 3개 키로만 소통한다.
// (계획서 §1.5 고정 인터페이스 계약 / §3 입력 / §4 출력·검증 / §4-4 리로드 방어)
//   - bookmon-ar-req       : 본 앱 → AR (조우 시작 시 1회 기록, image는 gameStore에서 해결)
//   - bookmon-ar-res       : AR → 본 앱 (종료 결과. 본 앱이 검증 후 소비/삭제)
//   - bookmon-ar-dismissed : 본 앱 내부 (close 후 근접 재트리거 쿨다운 — §4-4)
//
// AR은 전체 페이지 이동(리로드)으로 실행되므로 useEncounterFlow의 메모리 상태가 초기화된다.
// 계약·검증·쿨다운을 이 한 파일에 캡슐화해 2D·3D·향후 진입이 동일 경로로만 처리되게 한다.

import type { Game } from "@/types";

// ── sessionStorage 키 (계약) ──────────────────────────────────────
const REQ_KEY = "bookmon-ar-req";
const RES_KEY = "bookmon-ar-res";
const DISMISSED_KEY = "bookmon-ar-dismissed";

// ── 저장 포맷(직렬화) — 계획서 §3.1 ──────────────────────────────
export interface ArReq {
  mid: string; // = game.id (조우 단위 식별자)
  nonce: string; // crypto.randomUUID() — 결과 위조/재사용 차단
  ts: number; // Date.now() — 만료 판정
  image: string; // 스프라이트 경로(gameStore에서 해결). 없으면 "" → AR 내장 폴백
  return: string; // 복귀 pathname(basePath 포함). 예: "/bookmon_sample/map"
}
export interface ArRes {
  ar: "success" | "fail" | "close";
  nonce: string; // req.nonce echo
}
interface ArDismissed {
  mid: string;
  ts: number;
}

// basePath 접두 — 로컬은 "", 운영(GitHub Pages)은 "/bookmon_sample".
// (manifest.ts 와 동일 규칙. 런타임 값이 이미 접두돼 있으면 재적용하지 않는다.)
function withBase(path: string): string {
  const base = process.env.NEXT_PUBLIC_BASE_PATH?.trim() || "";
  return `${base}${path}`;
}

// return 경로 검증(open-redirect 방지) — 같은-origin 상대경로("/"로 시작, "//" 제외)만 허용.
// 절대 URL(http…) / 프로토콜상대(//…) 이면 null(무효). 스텁·본앱 양쪽에서 동일 검증.
function safeReturn(value: unknown): string | null {
  if (typeof value !== "string") return null;
  if (!value.startsWith("/")) return null;
  if (value.startsWith("//")) return null;
  return value;
}

// sessionStorage 읽기 — 항상 JSON.parse + 실패 방어(계획서 §3.1).
function readJson<T>(key: string): T | null {
  try {
    const raw = sessionStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

// ── 조우 시작: image 해결 + req 기록 + /ar/shooting/ 로 전체 이동 ──
// 흰 페이드가 끝난 직후(이동 직전) 호출한다. 쿼리 없음, 트레일링 슬래시.
export function launchAr(game: Game): void {
  // AR 스프라이트는 **256(AR용 고해상)만** 사용. 없으면 "" → 8thwall 내장 폴백(bookmon1.png)로 진행.
  //   thumbnail128/64 는 도감용(소형)·임시 경로라 AR 스프라이트로 넘기면 안 된다
  //   (넘긴 이미지가 404면 8thwall이 조기 종료 → AR이 로딩에서 멈춤).
  const image = game.monster.thumbnail256Url ?? "";
  const req: ArReq = {
    mid: game.id,
    nonce: crypto.randomUUID(),
    ts: Date.now(),
    image,
    // 복귀 경로 = 현재 pathname 그대로(2D /…/map 또는 3D /…/map3d, basePath 이미 포함).
    // withBase() 재적용 금지(이중 접두) — 계획서 §4-4.
    return: window.location.pathname,
  };
  sessionStorage.setItem(REQ_KEY, JSON.stringify(req));
  // 진입 경로 = /ar/shooting/index.html (쿼리 없음). dev·prod 양쪽 200으로 서빙되고,
  // 상대경로 자산(bundle.js/external/…)은 문서 디렉터리 /ar/shooting/ 기준으로 정상 해석된다.
  // (dev 서버는 public/ 디렉터리 인덱스를 슬래시 경로로 서빙하지 않아 명시 파일로 진입 — 계획서 §7.1)
  window.location.assign(withBase("/ar/shooting/index.html"));
}

// ── 복귀 결과 소비: 검증 게이트(§4-2) 통과 시에만 { ok, game } 반환 ──
// 통과/실패 무관하게 req·res 를 1회 소비(삭제)해 리플레이/새로고침 재실행을 차단한다.
// 호출부는 반드시 하이드레이션(games 준비) 완료 후 호출할 것(§4-4 High).
export function consumeArResult(games: Game[]): { ok: boolean; game: Game } | null {
  const res = readJson<ArRes>(RES_KEY);
  if (!res) return null; // 결과 없음 → AR 복귀 아님

  // read → 검증 → 키 삭제(먼저) → (호출부에서) capture 순서로 중복 안전(§4-4 Low).
  const req = readJson<ArReq>(REQ_KEY);
  sessionStorage.removeItem(REQ_KEY);
  sessionStorage.removeItem(RES_KEY);

  // §4-2 검증: ① 증표(req) 존재 ② nonce 일치 ③ mid 가 games 에 실존.
  if (!req) return null;
  if (res.nonce !== req.nonce) return null;
  const game = games.find((g) => g.id === req.mid); // mid = game.id (신뢰된 req에서만 취함)
  if (!game) return null;

  // success 만 포획. fail/close 는 ok=false (호출부가 페이드/쿨다운만 처리).
  return { ok: res.ar === "success", game };
}

// ── close 쿨다운(§4-4) — 근접 재트리거 루프 방지 ──
// close 후엔 포획이 없어 collection 스킵이 불가 → mid+ts 를 남겨 일정 시간 재발동 억제.
export function markDismissed(mid: string): void {
  const record: ArDismissed = { mid, ts: Date.now() };
  sessionStorage.setItem(DISMISSED_KEY, JSON.stringify(record));
}

export function isDismissed(mid: string, cooldownMs: number): boolean {
  const record = readJson<ArDismissed>(DISMISSED_KEY);
  if (!record || record.mid !== mid) return false;
  if (Date.now() - record.ts > cooldownMs) {
    sessionStorage.removeItem(DISMISSED_KEY); // 만료 → 정리
    return false;
  }
  return true;
}

// AR 복귀 여부(흰→지도 페이드 게이트용) — res 가 남아 있으면 AR 복귀(§4-4 Med).
export function hasArResult(): boolean {
  try {
    return sessionStorage.getItem(RES_KEY) !== null;
  } catch {
    return false;
  }
}

// return 경로 검증 export — 스텁 AR/향후 진입부 공용(open-redirect 방지).
export { safeReturn };
