// 단일 문서 주입 런타임 — AR(8thwall)을 별도 문서로 이동하지 않고 "현재 문서"에 주입한다.
//   기본(navigate) 모드에선 사용되지 않고, 통합 빌드에서 NEXT_PUBLIC_AR_EMBEDDED="true" 일 때만
//   useEncounterFlow 가 이 mountAr 를 호출한다. (통합 프로젝트 bookmon_unified 참조)
//   → 내비게이션이 없어 전체화면(Fullscreen API)이 유지되고, 최상위 문서라 카메라 권한도 상속.
//
// ★ 엔진 1회 로드 + 재시작(single-document reuse):
//   8thwall 엔진 스크립트(runtime/xr/bundle)는 재실행 시 getter/컴포넌트 재정의 충돌
//   ("attempting to change the getter of an unconfigurable property")로 스프라이트가 간헐 실패한다.
//   → 첫 조우에만 주입하고, 이후 조우는 재주입 없이 새 req + window.__bookmonRestart() 로 게임만 리셋.
//   종료 시 스크립트를 제거하지 않고 컨테이너/카메라 캔버스만 '숨김'(엔진 유지).
//
// 계약(sessionStorage req/res + window 훅) 보존:
//   - req(bookmon-ar-req, embedded:true) 를 AR 이 소비. quiz(v3) 포함.
//   - 종료 시 window.__bookmonEmbeddedDone(res) 콜백으로 결과 수신(embed.html finish() 분기).
//   - 재시작 시 window.__bookmonResetUI() + window.__bookmonRestart() (AR 측 훅).

import type { Game } from "@/types";

// embed.html = 통합 생성기가 AR index.html 을 자산 절대화 + embedded 분기 패치한 산출물.
const EMBED_URL = "/ar/shooting/embed.html";

type ArRes = { ar: "success" | "fail" | "close"; nonce?: string };

let container: HTMLDivElement | null = null;
let injected: HTMLScriptElement[] = [];
let engineLoaded = false; // 엔진 스크립트가 이미 주입·실행됐는지(재주입 금지 플래그)
let starting = false; // 첫 주입 진행 중 가드(동시 호출 방지)
let cameraObserver: MutationObserver | null = null;

// 컨테이너 z-index(최상위). 카메라 캔버스는 이 바로 아래에 깔아 UI 는 위, 카메라는 지도 위로.
const CONTAINER_Z = 2147483000;

// 8thwall runtime 은 렌더 캔버스(THREE.WebGLRenderer().domElement)를 position/z-index 없이
// document.body 의 '직접 자식' <canvas> 로 append 한다(id 없음). 주입 환경(뒤 100dvh 지도)에선
// 흐름상 화면 밖으로 밀려 안 보이므로 fixed·전체화면·컨테이너 바로 아래 z-index 로 깐다.
//   ※ 지도 r3f 캔버스는 React 루트 div 안 중첩이라 body 직접 자식이 아님 → 오판 없음.
function findArCanvas(): HTMLCanvasElement | null {
  const canvases = Array.from(document.body.children).filter(
    (el): el is HTMLCanvasElement => el.tagName === "CANVAS"
  );
  return canvases.length ? canvases[canvases.length - 1] : null;
}

function styleArCanvas(el: HTMLCanvasElement): void {
  el.style.position = "fixed";
  el.style.top = "0";
  el.style.left = "0";
  el.style.width = "100%";
  el.style.height = "100%";
  el.style.zIndex = String(CONTAINER_Z - 1000);
  el.style.display = ""; // 재표시(재진입 시)
}

function watchArCanvas(): void {
  const now = findArCanvas();
  if (now) {
    styleArCanvas(now);
    return;
  }
  cameraObserver = new MutationObserver(() => {
    const el = findArCanvas();
    if (el) {
      styleArCanvas(el);
      cameraObserver?.disconnect();
      cameraObserver = null;
    }
  });
  cameraObserver.observe(document.body, { childList: true });
  setTimeout(() => {
    cameraObserver?.disconnect();
    cameraObserver = null;
  }, 15000);
}

// req(계약) 작성 → sessionStorage 기록. 반환 nonce 로 결과(res.nonce) 검증한다.
function writeReq(game: Game): string {
  const m = game.monster;
  const q = game.quiz;
  const nonce =
    typeof crypto !== "undefined" && crypto.randomUUID
      ? crypto.randomUUID()
      : String(Date.now()) + Math.floor(performance.now());
  const req = {
    mid: game.id,
    nonce,
    ts: Date.now(),
    image: m.thumbnail256Url ?? "",
    sprites: {
      idle: m.spriteIdleUrl ?? "",
      left: m.spriteLeftUrl ?? "",
      right: m.spriteRightUrl ?? "",
      hit: m.spriteHitUrl ?? "",
    },
    captures: 3,
    // 포획 성공 후 AR 카메라 위에 띄울 퀴즈(계약 v3). AR 이 정답=성공/오답·시간초과=실패로 종료.
    //   title 은 카드 상단 표기(책 제목 데이터가 없어 몬스터명 임시 사용).
    quiz: q
      ? {
          content: q.content,
          type: q.type,
          choice1: q.choice1,
          choice2: q.choice2,
          choice3: q.choice3,
          choice4: q.choice4,
          answer: q.answer,
          description: q.description,
          title: m.koreanName,
        }
      : null,
    embedded: true,
    return: "",
  };
  try {
    sessionStorage.setItem("bookmon-ar-req", JSON.stringify(req));
  } catch {
    /* 무시 */
  }
  return nonce;
}

interface ArWindow {
  __bookmonEmbeddedDone?: (res: ArRes) => void;
  __bookmonResetUI?: () => void;
  __bookmonRestart?: () => void;
}

/**
 * AR 을 시작(첫 조우)하거나 재시작(이후 조우)한다. 종료 시 onDone(res) 1회 호출.
 *  - 첫 조우: 컨테이너 생성 + embed.html 주입(엔진 로드).
 *  - 이후 조우: 재주입 없이 새 req + __bookmonRestart() 로 게임만 리셋(엔진 유지).
 */
export async function mountAr(
  game: Game,
  onDone: (res: ArRes) => void
): Promise<void> {
  if (starting) return; // 첫 주입 동시호출 가드
  const w = window as unknown as ArWindow;

  // 1) 이번 조우 req 기록 + 종료 콜백(새 nonce로) 등록.
  const nonce = writeReq(game);
  let done = false;
  w.__bookmonEmbeddedDone = (res: ArRes) => {
    if (done) return;
    done = true;
    const ok = res && res.nonce === nonce ? res : { ar: "close" as const };
    try {
      onDone(ok);
    } finally {
      hideAr(); // 엔진은 유지, 화면만 숨김(다음 조우에 재시작)
    }
  };

  // 2) 재진입 — 엔진이 이미 로드됨: 재주입 없이 리셋 + 재시작.
  if (engineLoaded && container) {
    showAr();
    try {
      w.__bookmonResetUI?.();
      w.__bookmonRestart?.();
    } catch {
      /* 무시 */
    }
    return;
  }

  // 3) 첫 조우 — 컨테이너 생성 + embed.html 주입.
  starting = true;

  // 전체화면 컨테이너(최상위). ⚠ 배경은 반드시 '투명'(카메라 캔버스가 body에 별도로 깔림).
  container = document.createElement("div");
  container.id = "bookmon-ar-embed";
  container.style.cssText = `position:fixed;inset:0;z-index:${CONTAINER_Z};background:transparent;`;
  document.body.appendChild(container);

  try {
    const html = await fetch(EMBED_URL).then((r) => {
      if (!r.ok) throw new Error(`embed.html ${r.status}`);
      return r.text();
    });
    const doc = new DOMParser().parseFromString(html, "text/html");

    // head <style> → 문서 head (게임 UI 스타일)
    doc.head.querySelectorAll("style").forEach((s) => {
      document.head.appendChild(document.importNode(s, true));
    });

    // body 의 비-스크립트 노드 → 컨테이너, 스크립트는 순서 보존해 수집
    const bodyScripts: HTMLScriptElement[] = [];
    Array.from(doc.body.childNodes).forEach((node) => {
      if (node.nodeName === "SCRIPT") {
        bodyScripts.push(node as HTMLScriptElement);
      } else {
        container!.appendChild(document.importNode(node, true));
      }
    });

    // 실행 순서 = head(runtime.js/xr.js/landing-page.js) → body(인라인 훅 + bundle.js).
    const headScripts = Array.from(
      doc.head.querySelectorAll("script")
    ) as HTMLScriptElement[];
    for (const old of [...headScripts, ...bodyScripts]) {
      await appendScript(old);
    }

    engineLoaded = true;
    // 엔진이 body 에 붙이는 AR 렌더 캔버스를 배경으로 깔도록 스타일링(비동기 생성 관찰).
    watchArCanvas();
  } catch (e) {
    console.error("[arInject] mount failed:", e);
    w.__bookmonEmbeddedDone?.({ ar: "close" });
  } finally {
    starting = false;
  }
}

// <script> 를 실제 실행되도록 재생성해 추가. 외부(src)는 async=false 로 순서 보장 + 로드 대기.
function appendScript(old: HTMLScriptElement): Promise<void> {
  return new Promise((resolve) => {
    const s = document.createElement("script");
    for (const a of Array.from(old.attributes)) s.setAttribute(a.name, a.value);
    injected.push(s);
    if (old.src) {
      s.async = false;
      s.onload = () => resolve();
      s.onerror = () => resolve();
      document.body.appendChild(s);
    } else {
      s.textContent = old.textContent || "";
      document.body.appendChild(s);
      resolve();
    }
  });
}

// 화면만 숨김(엔진 유지) — 다음 조우에 재시작. 카메라 캔버스도 함께 숨겨 지도 위에 안 비치게.
function hideAr(): void {
  if (container) container.style.display = "none";
  const cv = findArCanvas();
  if (cv) cv.style.display = "none";
}

// 화면 재표시(재진입).
function showAr(): void {
  if (container) container.style.display = "";
  const cv = findArCanvas();
  if (cv) styleArCanvas(cv);
}

/**
 * AR 이 현재 화면에 활성(진행 중)인지 — 조우 잠금 고착 복구 판단용.
 *   컨테이너가 있고 숨김(display:none)이 아니면 활성. 종료 시 hideAr 로 숨겨 false 가 된다.
 *   useEncounterFlow 가 leaving 이 true 인데 이 값이 false 면 "비정상 종료로 잠금 고착"으로 보고 복구.
 */
export function isArActive(): boolean {
  return container !== null && container.style.display !== "none";
}

/**
 * AR 완전 teardown — 카메라/엔진 정지 + 주입 스크립트/DOM 제거.
 *   단일 문서 재사용에선 조우마다 호출하지 않고(hideAr 로 유지), 세션 종료 등에서만 쓴다.
 *   ⚠ 재실행 오염 때문에 teardown 후 다시 mountAr 하면 재주입이 일어난다 — 되도록 쓰지 말 것.
 */
export function unmountAr(): void {
  const w = window as unknown as { __bookmonStopAR?: () => void };
  try {
    w.__bookmonStopAR?.();
  } catch {
    /* 무시 */
  }
  cameraObserver?.disconnect();
  cameraObserver = null;
  findArCanvas()?.remove();
  injected.forEach((s) => s.remove());
  injected = [];
  if (container) {
    container.remove();
    container = null;
  }
  engineLoaded = false;
  try {
    delete (window as unknown as Record<string, unknown>).__bookmonEmbeddedDone;
  } catch {
    /* 무시 */
  }
}
