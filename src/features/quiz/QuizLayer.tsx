"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Quiz } from "@/types";
import { ASSETS } from "@/constants/assets";

const DEFAULT_DURATION_SEC = 10; // 제한 시간 (임시)
const FEEDBACK_HOLD_MS = 1200; // 정답/오답 피드백 노출 후 닫힘까지 (임시)

export interface QuizLayerProps {
  quiz: Quiz;
  title?: string; // 책이름(카드 상단). 없으면 제목 줄 숨김.
  durationSec?: number;
  onCorrect: () => void; // 정답 이벤트
  onWrong: () => void; // 오답 이벤트
  onTimeout: () => void; // 시간초과 이벤트
  onClose?: () => void; // 피드백 종료 후 레이어 닫힘
}

// 종료 결과 — 정답(성공) 또는 시간초과(실패)만 퀴즈를 끝낸다. 오답 클릭은 종료가 아니다.
type Phase =
  | { kind: "answering" }
  | { kind: "feedback"; result: "correct" | "timeout" };

/**
 * 퀴즈 레이어 (모듈형) — 포획 성공 시 표시. gameStore의 몬스터별 quiz를 렌더한다.
 *  - 진행 규칙: 정답을 맞히면 성공(O)으로 종료. 오답을 눌러도 종료하지 않고 그 선택지만 제거(비활성)하고
 *    계속 진행한다. 실질적 실패는 시간초과(타임아웃, X)뿐이다.
 *  - 콜백: onCorrect(정답·1회), onTimeout(시간초과·1회) = 종료. onWrong = 오답 클릭마다(비종료) 통지.
 *  - 선택지는 quiz.choice1~4 중 존재하는 것만 → 2개면 1행, 4개면 2행으로 유동 배치(2/4지선다 대응).
 *  - 디자인: 빈 책 프레임(quiz_book_frame.png) 배경 + 종이 영역에 동적 내용. 답 버튼은 텍스처 PNG 프레임.
 *    타임 바는 quiz_bar.svg 레퍼런스로 CSS 재구성(채움 %가 동적이라 정적 SVG 불가).
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
  const choices = [quiz.choice1, quiz.choice2, quiz.choice3, quiz.choice4]
    .map((text, i) => ({ text, index: i + 1 }))
    .filter((c): c is { text: string; index: number } => !!c.text);

  const [phase, setPhase] = useState<Phase>({ kind: "answering" });
  const [remainingMs, setRemainingMs] = useState(durationSec * 1000);
  const [wrongPicks, setWrongPicks] = useState<number[]>([]); // 오답으로 제거된 선택지들
  const [wrongFlash, setWrongFlash] = useState(0); // 오답 시 중앙 X 팝업 트리거(키, 증가마다 재생)
  const resolvedRef = useRef(false); // 종료 이벤트 1회 보장

  // 종료 확정 → 성공/시간초과 이벤트 1회 발화 + 피드백 단계로.
  const resolve = useCallback(
    (result: "correct" | "timeout") => {
      if (resolvedRef.current) return;
      resolvedRef.current = true;
      if (result === "correct") onCorrect();
      else onTimeout();
      setPhase({ kind: "feedback", result });
    },
    [onCorrect, onTimeout]
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
        resolve("timeout");
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
    if (wrongPicks.includes(index)) return; // 이미 제거된 오답
    if (index === quiz.answer) {
      resolve("correct"); // 정답 → 성공 종료
    } else {
      // 오답 → 종료하지 않고 그 선택지만 제거. 타임아웃 전까지 계속 시도 가능.
      setWrongPicks((prev) => [...prev, index]);
      setWrongFlash((k) => k + 1); // 중앙 X 팝업(나타났다 사라짐)
      onWrong(); // 오답 시도 통지(비종료)
    }
  };

  const remainingSec = Math.ceil(remainingMs / 1000);
  const ratio = Math.max(0, Math.min(1, remainingMs / (durationSec * 1000)));

  // 선택지 4개면 2행(2열), 2개(이하)면 1행 — 유동 배치.
  const twoRows = choices.length > 2;

  return (
    <div
      onPointerDown={(e) => e.stopPropagation()}
      className="fixed inset-0 z-[70] flex items-center justify-center bg-navy/55 p-3"
    >
      {/* 세로 스택: [책 카드] + 그 아래 [타임 바](책 밖). */}
      <div className="flex w-[min(94vw,560px)] flex-col items-center gap-2">
        {/* 카드 = 빈 책 프레임(quiz_book_frame.png) 배경. 원본 종횡비 1443×897 유지. */}
        <div
          className="relative w-full"
          style={{
            aspectRatio: "1443 / 897",
            backgroundImage: `url(${ASSETS.quizBookFrame})`,
            backgroundSize: "100% 100%",
            backgroundRepeat: "no-repeat",
          }}
        >
          {/* 책 종이 안쪽 — 위부터: 책이름 → 질문 → 선택지. */}
          <div className="absolute inset-0 flex flex-col px-[9%] pb-[13%] pt-[5%]">
            {/* 책이름(제목) — 상단 중앙(리본은 좌측 baked라 겹치지 않음). */}
            {title && (
              <p className="truncate px-[16%] text-center text-[clamp(0.85rem,3.4vw,1.15rem)] font-extrabold text-[#2f6fd0]">
                {title}
              </p>
            )}

            {/* 질문 — 가운데. (피드백 시엔 아래 O/X 마크가 카드 위에 뜬다) */}
            <div className="flex flex-1 items-center justify-center px-2 py-1">
              <p className="text-center text-[clamp(0.75rem,3vw,1rem)] font-bold leading-relaxed text-navy">
                {quiz.content}
              </p>
            </div>

            {/* 선택지 — 버튼 색은 교대(홀수 파랑 / 짝수 골드), 크기 축소(좌우 인셋). 2개=1행 / 4개=2행. */}
            <div
              className={`grid grid-cols-2 gap-x-[8%] px-[6%] ${twoRows ? "gap-y-[3%]" : ""}`}
            >
              {choices.map((c) => {
                // 오답으로 제거된 선택지 → 어둡게 비활성(재클릭 불가). 나머지는 계속 시도 가능.
                const eliminated = wrongPicks.includes(c.index);
                const disabled = phase.kind !== "answering" || eliminated;
                // 기본 색: 홀수=파랑 / 짝수=골드(샘플의 신칸센=파랑·JR=골드 교대).
                const frame =
                  c.index % 2 === 1 ? ASSETS.quizBtnBlue : ASSETS.quizBtnGold;
                return (
                  <button
                    key={c.index}
                    type="button"
                    disabled={disabled}
                    onClick={() => pick(c.index)}
                    style={{
                      aspectRatio: "479 / 236",
                      backgroundImage: `url(${frame})`,
                      backgroundSize: "100% 100%",
                      backgroundRepeat: "no-repeat",
                    }}
                    // 클릭 눌림 효과: 살짝 내려가며 축소·어두워짐.
                    className="relative w-full transition-transform duration-75 active:translate-y-[3px] active:scale-[0.98] active:brightness-95"
                  >
                    {/* 라벨은 버튼 면(그림자 위쪽 ~43% 지점)에 정렬 */}
                    <span className="absolute left-1/2 top-[43%] w-[86%] -translate-x-1/2 -translate-y-1/2 text-center text-[clamp(0.7rem,2.8vw,1rem)] font-extrabold leading-tight text-white [text-shadow:0_2px_3px_rgba(0,0,0,0.35)]">
                      {c.text}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 결과 마크 — 정답 O / 시간초과 X. 카드 중앙에 팝업(종료 시). */}
          {phase.kind === "feedback" && (
            <ResultMark correct={phase.result === "correct"} />
          )}

          {/* 오답 플래시 — 오답 클릭 시 중앙에 X가 나타났다 사라짐(비종료). key로 매번 재생. */}
          {wrongFlash > 0 && (
            <WrongFlash
              key={wrongFlash}
              onDone={() => setWrongFlash(0)}
            />
          )}
        </div>

        {/* 타임 바 — 책 밖(아래). quiz_bar 톤: 파란 트랙 + 초록 채움 + 중앙 'N초'. */}
        <div className="relative h-6 w-[94%] overflow-hidden rounded-full border-2 border-[#124889] bg-[#366ab4]">
          <div
            className="h-full rounded-full bg-gradient-to-r from-[#8ced2b] to-[#4eee11] transition-[width] duration-100 ease-linear"
            style={{ width: `${ratio * 100}%` }}
          />
          <span className="absolute inset-0 flex items-center justify-center text-xs font-extrabold text-white tabular-nums [text-shadow:0_1px_1px_rgba(0,0,0,0.4)]">
            {remainingSec}초
          </span>
        </div>
      </div>
    </div>
  );
}

// 오답 플래시 — 카드 중앙에 X 배지가 나타났다 사라진다(결과 O 마크와 동일 디자인, 비종료).
// 애니메이션 종료 시 onDone으로 숨김. (팝인 → 잠깐 유지 → 페이드아웃)
function WrongFlash({ onDone }: { onDone: () => void }) {
  return (
    <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center">
      <div
        onAnimationEnd={onDone}
        className="flex aspect-square w-[34%] max-w-[160px] animate-[quiz-flash_900ms_ease-out_forwards] items-center justify-center rounded-full border-[6px] border-navy bg-ivory/95 shadow-[0_10px_24px_rgba(0,0,0,0.35)]"
      >
        <svg viewBox="0 0 100 100" className="h-[62%] w-[62%]" fill="none" strokeLinecap="round">
          <line x1="28" y1="28" x2="72" y2="72" stroke="#e23c3c" strokeWidth="14" />
          <line x1="72" y1="28" x2="28" y2="72" stroke="#e23c3c" strokeWidth="14" />
        </svg>
      </div>
    </div>
  );
}

/**
 * 결과 마크 (임시 디자인) — 정답 O(스카이블루) / 오답 X(빨강).
 * 북몬 톤: 크림 원형 배지 + 네이비 테두리 + 굵은 라운드 마크. 카드 중앙에 팝업.
 */
function ResultMark({ correct }: { correct: boolean }) {
  return (
    <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center">
      <div className="flex aspect-square w-[34%] max-w-[160px] animate-[quiz-pop_260ms_cubic-bezier(0.34,1.56,0.64,1)_backwards] items-center justify-center rounded-full border-[6px] border-navy bg-ivory/95 shadow-[0_10px_24px_rgba(0,0,0,0.35)]">
        <svg viewBox="0 0 100 100" className="h-[62%] w-[62%]" fill="none" strokeLinecap="round">
          {correct ? (
            <circle
              cx="50"
              cy="50"
              r="30"
              stroke="#019cf4"
              strokeWidth="14"
            />
          ) : (
            <>
              <line x1="28" y1="28" x2="72" y2="72" stroke="#e23c3c" strokeWidth="14" />
              <line x1="72" y1="28" x2="28" y2="72" stroke="#e23c3c" strokeWidth="14" />
            </>
          )}
        </svg>
      </div>
    </div>
  );
}
