"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Quiz } from "@/types";
import { ASSETS } from "@/constants/assets";

const DEFAULT_DURATION_SEC = 10; // 제한 시간 (임시)
const FEEDBACK_HOLD_MS = 1200; // 정답/오답 피드백 노출 후 닫힘까지 (임시)

// 실측 색값 (bookmon_design/new/quiz 애셋에서 sharp 픽셀 추출).
const C = {
  oBlue: "#3780ff", // O 링·채움 파랑 (Frame 151/169)
  xRed: "#ff4b37", // X 링·채움 빨강 (Frame 152/170)
  choiceSky: "#06b0ff", // 선택지 테두리·채움 하늘 (quiz_btn / Frame 168)
  titleBlue: "#2f6fd0", // 상단 제목 파랑
  gaugeFrame: "#724019", // 게이지 갈색 캡슐 (Frame 167)
  gaugeTrack: "#372314", // 게이지 안쪽 진갈색 트랙
  gaugeFillTop: "#6eb72d", // 초록 채움 상단 (Rectangle 8)
  gaugeFillBot: "#055a25", // 초록 채움 하단
  gaugeText: "#ffdd32", // 게이지 골드 텍스트 (Frame 166)
} as const;

export interface QuizLayerProps {
  quiz: Quiz;
  title?: string; // 책이름(카드 상단). 없으면 제목 줄 숨김.
  durationSec?: number;
  onCorrect: () => void; // 정답 이벤트
  onWrong: () => void; // 오답 이벤트
  onTimeout: () => void; // 시간초과 이벤트
  onClose?: () => void; // 피드백 종료 후 레이어 닫힘
}

// 종료 결과 — 각 퀴즈는 1회만 시도. 정답=성공, 오답/시간초과=실패로 즉시 끝난다.
type Phase =
  | { kind: "answering" }
  | { kind: "feedback"; result: "correct" | "wrong" };

/**
 * 퀴즈 레이어 (모듈형) — 포획 성공 시 표시. gameStore의 몬스터별 quiz를 렌더한다.
 *  - 진행 규칙: 정답을 맞히면 성공(O)으로 종료. 오답을 눌러도 종료하지 않고 그 선택지만 제거(비활성)하고
 *    계속 진행한다. 실질적 실패는 시간초과(타임아웃, X)뿐이다.
 *  - 콜백: onCorrect(정답·1회), onTimeout(시간초과·1회) = 종료. onWrong = 오답 클릭마다(비종료) 통지.
 *  - 디자인: 책 프레임 PNG(quiz_frame.png)만 이미지 사용. O/X·선택지·게이지는 전부 CSS.
 *    · OX형(quiz.type==="OX"): 하단에 원형 O(choice1)·X(choice2) 버튼. 정답 색채움, 오답 클릭 시 비활성.
 *    · 선택지형(CHOICE/BLANK): 하단에 알약 버튼. 2개면 1행, 4개면 2행. BLANK 문항의 빈칸은 밑줄 박스.
 *    · 게이지: 책 밖 아래. 갈색 캡슐 + 진갈색 트랙 + 초록 채움(남은시간 비례) + 중앙 골드 'N초'.
 */
export function QuizLayer({
  quiz,
  title,
  durationSec = DEFAULT_DURATION_SEC,
  onCorrect,
  onWrong,
  onTimeout,
  onClose,
}: QuizLayerProps) {
  const isOX = quiz.type === "OX";
  const choices = [quiz.choice1, quiz.choice2, quiz.choice3, quiz.choice4]
    .map((text, i) => ({ text, index: i + 1 }))
    .filter((c): c is { text: string; index: number } => !!c.text);

  const [phase, setPhase] = useState<Phase>({ kind: "answering" });
  const [remainingMs, setRemainingMs] = useState(durationSec * 1000);
  const resolvedRef = useRef(false); // 종료 이벤트 1회 보장

  // 종료 확정 → 정답(성공)/오답/시간초과(실패) 이벤트 1회 발화 + 피드백 단계로.
  //   각 퀴즈 1회 시도: 오답을 눌러도 곧바로 실패로 끝난다.
  const resolve = useCallback(
    (result: "correct" | "wrong" | "timeout") => {
      if (resolvedRef.current) return;
      resolvedRef.current = true;
      if (result === "correct") onCorrect();
      else if (result === "wrong") onWrong();
      else onTimeout();
      // 피드백 표시는 성공/실패 2종(오답·시간초과 모두 "wrong").
      setPhase({ kind: "feedback", result: result === "correct" ? "correct" : "wrong" });
    },
    [onCorrect, onWrong, onTimeout]
  );

  // 카운트다운 (answering 동안만). 0이 되면 시간초과로 종료(실패).
  useEffect(() => {
    if (phase.kind !== "answering") return;
    const end = Date.now() + remainingMs;
    const id = setInterval(() => {
      const left = end - Date.now();
      if (left <= 0) {
        clearInterval(id);
        setRemainingMs(0);
        resolve("timeout"); // 시간초과 → 실패
      } else {
        setRemainingMs(left);
      }
    }, 100);
    return () => clearInterval(id);
    // remainingMs는 시작값 캡처용 — phase 전환 시에만 재설정.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase.kind, resolve]);

  // 피드백 노출 후 자동 닫힘.
  useEffect(() => {
    if (phase.kind !== "feedback") return;
    const id = setTimeout(() => onClose?.(), FEEDBACK_HOLD_MS);
    return () => clearTimeout(id);
  }, [phase, onClose]);

  const pick = (index: number) => {
    if (phase.kind !== "answering") return;
    // 1회 시도: 정답=성공, 오답=실패로 즉시 종료.
    resolve(index === quiz.answer ? "correct" : "wrong");
  };

  const remainingSec = Math.ceil(remainingMs / 1000);
  const ratio = Math.max(0, Math.min(1, remainingMs / (durationSec * 1000)));
  const answering = phase.kind === "answering";

  return (
    <div
      onPointerDown={(e) => e.stopPropagation()}
      className="fixed inset-0 z-[70] flex items-center justify-center bg-navy/55 p-3"
    >
      {/* 세로 스택: [책 카드] + 그 아래 [타임 바](책 밖).
          폭을 vw·상한·dvh 세 기준의 min 으로 → 가로모드(세로 짧음)에선 dvh가 폭을 제한해
          카드가 줄고 게이지까지 화면에 들어온다. (카드 종횡비 1.48 + 게이지/여백분 반영해 108dvh) */}
      <div className="flex w-[min(94vw,560px,108dvh)] flex-col items-center gap-2">
        {/* 카드 = 책 프레임 PNG(quiz_frame.png) 배경. 원본 종횡비 1400×945 유지. */}
        <div
          className="@container relative w-full"
          style={{
            aspectRatio: "1400 / 945",
            backgroundImage: `url(${ASSETS.quizBookFrame})`,
            backgroundSize: "100% 100%",
            backgroundRepeat: "no-repeat",
          }}
        >
          {/* 책 종이 안쪽 인셋 — 프레임 흰 종이 영역(측정): L 8%·R 9%·T 11%·B 18.5%. */}
          <div className="absolute inset-x-[8%] bottom-[18.5%] top-[11%] flex flex-col">
            {/* 제목 — 파란 볼드(가운데 정렬) + 그 아래 가운데 정렬된 긴 가로줄. */}
            {title && (
              <div className="pt-[1%] text-center">
                <p
                  className="truncate px-[2%] text-center text-[4.6cqw] font-normal"
                  style={{ color: C.titleBlue }}
                >
                  {title}
                </p>
                {/* 가로줄 — 제목 아래, 가운데 정렬(시안 비율). */}
                <div
                  className="mx-auto mt-[1.2%] h-[2px] w-[62%] rounded-full"
                  style={{ background: C.titleBlue }}
                />
              </div>
            )}

            {/* 질문 — 상·중단. 폰트는 (a) 카드 폭(cqw) + (b) 글자 수에 따라 자동 축소 →
                질문이 길어져도 영역을 넘지 않게. min-h-0 + overflow-hidden 으로 이중 방어. */}
            <div className="flex min-h-0 flex-1 items-center justify-center overflow-hidden px-2 py-1">
              <p
                className="text-center font-normal leading-snug text-navy"
                style={{ fontSize: questionFontSize(quiz.content.length) }}
              >
                {renderContent(quiz.content, quiz.type === "BLANK")}
              </p>
            </div>

            {/* 답 영역 — OX형: 원형 O·X / 선택지형: 알약 버튼. (1회 시도라 답하면 종료) */}
            {isOX ? (
              <OXChoices
                oText={quiz.choice1}
                xText={quiz.choice2}
                disabled={!answering}
                onPickO={() => pick(1)}
                onPickX={() => pick(2)}
              />
            ) : (
              <PillChoices choices={choices} answering={answering} onPick={pick} />
            )}
          </div>

          {/* 결과 피드백 — 정답: "정답"+꽃가루 / 오답·시간초과: "오답". 카드 중앙 팝업(종료 시). */}
          {phase.kind === "feedback" && (
            <ResultMark correct={phase.result === "correct"} />
          )}
        </div>

        {/* 타임 바 — 책 밖(아래). 갈색 캡슐 + 진갈색 트랙 + 초록 채움 + 중앙 골드 'N초'. */}
        <TimeGauge ratio={ratio} remainingSec={remainingSec} />
      </div>
    </div>
  );
}

// 질문 폰트 크기 — 글자 수에 따라 cqw 단계를 낮춘다. cqw = 카드 폭 1% 라 화면 크기에도 자동 비례.
//   짧은 질문은 큼, 길수록 작아져서 카드 영역을 넘지 않는다.
function questionFontSize(len: number): string {
  if (len > 110) return "1.3cqw";
  if (len > 80) return "1.5cqw";
  if (len > 55) return "1.75cqw";
  if (len > 35) return "2cqw";
  return "2.3cqw";
}

// 문제문 렌더 — BLANK형이면 첫 공백/언더스코어 구간을 밑줄 박스로 치환(시안의 빈칸 표현).
// 밑줄 표기가 없으면 원문 그대로. (연속 '_' 3개 이상 또는 전각 빈칸을 빈칸으로 간주)
function renderContent(content: string, isBlank: boolean) {
  if (!isBlank) return content;
  const m = content.match(/_{3,}|\s{4,}/);
  if (!m || m.index === undefined) return content;
  const before = content.slice(0, m.index);
  const after = content.slice(m.index + m[0].length);
  return (
    <>
      {before}
      <span className="mx-1 inline-block h-[1.1em] w-[3.4em] translate-y-[0.15em] rounded-[4px] border-b-[3px] border-navy align-baseline" />
      {after}
    </>
  );
}

// OX형 답 — 원형 O(choice1)·X(choice2) 버튼.
// 기본=흰 배경+컬러 링+컬러 글자, 활성/hover/press=컬러 채움+흰 글자(Frame169/170).
// 오답으로 제거되면 반투명 비활성.
function OXChoices({
  oText,
  xText,
  disabled,
  onPickO,
  onPickX,
}: {
  oText: string;
  xText: string;
  disabled: boolean;
  onPickO: () => void;
  onPickX: () => void;
}) {
  return (
    // 프레임 하단과 여백(mb) 확보. O·X 간격 넓게.
    <div className="mb-[7%] flex items-center justify-center gap-[24%] px-[8%] pb-[1%]">
      <OXButton mark="O" color={C.oBlue} label={oText} disabled={disabled} onClick={onPickO} />
      <OXButton mark="X" color={C.xRed} label={xText} disabled={disabled} onClick={onPickX} />
    </div>
  );
}

function OXButton({
  mark,
  color,
  label,
  disabled,
  onClick,
}: {
  mark: "O" | "X";
  color: string;
  label: string;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      aria-label={label || mark}
      // minHeight/minWidth:0 인라인 강제 — 전역 button{min-*:48px}이 aspect-square 를 깨서
      //   작은 화면에서 타원이 되던 문제 해제(완전 정원 유지).
      style={{ borderColor: color, color, minHeight: 0, minWidth: 0, "--ox": color } as React.CSSProperties}
      className={[
        "group relative grid aspect-square w-[22%] place-items-center rounded-full border-[5px] bg-white",
        "shadow-[0_6px_10px_rgba(0,0,0,0.18)] transition duration-100",
        // hover/press/활성: 컬러 채움 + 흰 마크(SVG stroke=currentColor 라 text-white 로 흰색).
        "hover:bg-[var(--ox)] hover:text-white active:translate-y-[3px] active:scale-[0.97] active:bg-[var(--ox)] active:text-white",
        disabled ? "pointer-events-none opacity-35 grayscale" : "",
      ].join(" ")}
    >
      {/* O=원 링 / X=두 선 — SVG 로 정확한 기하(폰트 글리프 왜곡 방지). 색은 currentColor. */}
      <svg
        viewBox="0 0 100 100"
        className="h-[58%] w-[58%]"
        fill="none"
        stroke="currentColor"
        strokeWidth={mark === "O" ? 15 : 16}
        strokeLinecap="round"
        aria-hidden="true"
      >
        {mark === "O" ? (
          <circle cx="50" cy="50" r="31" />
        ) : (
          <>
            <line x1="30" y1="30" x2="70" y2="70" />
            <line x1="70" y1="30" x2="30" y2="70" />
          </>
        )}
      </svg>
    </button>
  );
}

// 선택지형 답 — 알약 버튼(흰 배경+하늘 테두리+검정 글자). hover/press=하늘 채움+흰 글자.
// 2개면 1행, 4개면 2행. 오답 제거된 선택지는 반투명 비활성.
function PillChoices({
  choices,
  answering,
  onPick,
}: {
  choices: { text: string; index: number }[];
  answering: boolean;
  onPick: (index: number) => void;
}) {
  const twoRows = choices.length > 2;
  return (
    // 버튼 영역: 가로 20%↓(86%→69%), 세로 10%↓(아래 여백 mb 로 프레임과 간격 확보).
    <div
      className={`mx-auto grid w-[69%] grid-cols-2 gap-x-[7%] pb-[1%] mb-[6%] ${twoRows ? "gap-y-[6%]" : ""}`}
    >
      {choices.map((c) => {
        const disabled = !answering;
        return (
          <button
            key={c.index}
            type="button"
            disabled={disabled}
            onClick={() => onPick(c.index)}
            // minHeight:0 은 인라인으로 강제 — 전역 button{min-height:48px}(globals.css, unlayered)이
            // Tailwind min-h-0 를 이겨서 작은 화면에서 버튼이 세로로 통통해지던 문제를 확실히 해제.
            style={{ borderColor: C.choiceSky, minHeight: 0, "--sky": C.choiceSky } as React.CSSProperties}
            className={[
              // aspect 4.19:1 고정 + max-h 상한으로 더 커지지 않게.
              "relative grid aspect-[4.19/1] max-h-[46px] w-full place-items-center rounded-[10px] border-2 bg-white px-2",
              "text-center text-[2.4cqw] font-medium text-navy",
              "shadow-[0_2px_5px_rgba(0,0,0,0.12)] transition duration-100",
              "hover:bg-[var(--sky)] hover:text-white active:translate-y-[3px] active:scale-[0.98] active:bg-[var(--sky)] active:text-white",
              disabled ? "pointer-events-none opacity-35 grayscale" : "",
            ].join(" ")}
          >
            <span className="block w-full truncate">{c.text}</span>
          </button>
        );
      })}
    </div>
  );
}

// 타임 바 — 갈색 캡슐 프레임 + 안쪽 진갈색 트랙 + 초록 채움(왼→오, 남은시간 비례) + 중앙 골드 'N초'.
// 애셋(Frame166/167 + Rectangle8) 톤을 CSS 그라데로 재현(채움 %가 동적이라 PNG 불가).
function TimeGauge({ ratio, remainingSec }: { ratio: number; remainingSec: number }) {
  return (
    <div
      className="w-[94%] shrink-0 rounded-full p-[3px] shadow-[0_4px_8px_rgba(0,0,0,0.35)]"
      style={{ background: C.gaugeFrame }}
    >
      {/* 안쪽 진갈색 트랙 — 높이 반응형(가로모드에서도 납작하지 않게 clamp). */}
      <div
        className="relative h-[clamp(14px,3.4dvh,22px)] overflow-hidden rounded-full"
        style={{ background: C.gaugeTrack }}
      >
        {/* 초록 채움 — 위→아래 그라데 + 위 하이라이트. width = 남은시간 비율. */}
        <div
          className="h-full rounded-full transition-[width] duration-100 ease-linear"
          style={{
            width: `${ratio * 100}%`,
            background: `linear-gradient(180deg, ${C.gaugeFillTop} 0%, ${C.gaugeFillBot} 100%)`,
            boxShadow: "inset 0 2px 2px rgba(255,255,255,0.45)",
          }}
        />
        <span
          className="absolute inset-0 flex items-center justify-center text-xs font-extrabold tabular-nums [text-shadow:0_1px_1px_rgba(0,0,0,0.5)]"
          style={{ color: C.gaugeText }}
        >
          {remainingSec}초
        </span>
      </div>
    </div>
  );
}

/**
 * 결과 피드백 — 정답: "정답" 텍스트가 작아졌다 커지며 + 꽃가루(컨페티) 터짐.
 *              시간초과(실패): "오답" 텍스트.
 * 카드 중앙에 팝업.
 */
function ResultMark({ correct }: { correct: boolean }) {
  return (
    <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center">
      {correct && <Confetti />}
      <span
        className="animate-[answer-pop_520ms_cubic-bezier(0.34,1.56,0.64,1)_both] text-[14cqw] font-bold leading-none [text-shadow:0_3px_0_rgba(0,0,0,0.18),0_6px_10px_rgba(0,0,0,0.25)]"
        style={{ color: correct ? C.oBlue : C.xRed }}
      >
        {correct ? "정답" : "오답"}
      </span>
    </div>
  );
}

// 꽃가루(컨페티) — 중앙에서 사방으로 터지는 색색 조각들(CSS). 방향/색은 index로 결정(랜덤 미사용).
const CONFETTI_COLORS = ["#ff4b37", "#3780ff", "#ffdd32", "#2ec76a", "#ff8fc7", "#8b5cf6"];
function Confetti() {
  const N = 16;
  return (
    <div className="pointer-events-none absolute left-1/2 top-1/2 h-0 w-0">
      {Array.from({ length: N }, (_, i) => {
        const angle = (i / N) * Math.PI * 2;
        const dist = 70 + (i % 4) * 22; // 방사 거리(변주)
        const cx = `${Math.cos(angle) * dist}px`;
        const cy = `${Math.sin(angle) * dist}px`;
        const cr = `${(i % 2 === 0 ? 1 : -1) * (360 + (i % 3) * 120)}deg`;
        const color = CONFETTI_COLORS[i % CONFETTI_COLORS.length];
        const round = i % 3 === 0; // 일부는 원, 나머지는 사각 조각
        return (
          <span
            key={i}
            className={`absolute block h-[10px] w-[7px] animate-[confetti-fly_900ms_ease-out_forwards] ${round ? "rounded-full" : "rounded-[1px]"}`}
            style={
              {
                left: 0,
                top: 0,
                background: color,
                "--cx": cx,
                "--cy": cy,
                "--cr": cr,
              } as React.CSSProperties
            }
          />
        );
      })}
    </div>
  );
}
