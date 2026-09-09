import type { ButtonHTMLAttributes } from "react";

/**
 * 온보딩 공용 CTA 버튼 — 텍스트리스 기본 버튼(button/next_btn2.png=골드 기본,
 * next_btn.png=주황 눌림)의 pill을 **픽셀 실측색으로 CSS 재현**한 것.
 * 이미지에 글자가 없으므로 라벨("다음"/"시작"/"뒤로"/"검색 중…")을 텍스트로 얹어 공유한다.
 *
 * 실측색(next_btn2.png / next_btn.png 픽셀 추출):
 *  - 기본(gold): 면 그라데이션 #fec50f→#f4b408→#eca803, 하단 림(입체) #7c3e00, 라벨 갈색 #6b3400.
 *    (별도 밝은 테두리 링 없음 — 면+상단 광택+하단 림으로만 입체.)
 *  - 눌림(press, 주황): 면 #ff8f26→#f37414→#ec6105, 림 #7c3e00.
 *    active 시 주황으로 바뀌며 살짝 내려앉는다(눌린 상태 재현).
 */
export function CtaButton({
  children,
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      {...props}
      className={[
        // 크기: 버튼 이미지 pill 비율(535×195 ≈ 2.74:1)에 맞춘 폭/높이.
        "flex h-[52px] w-[180px] items-center justify-center whitespace-nowrap",
        // 피그마: border-radius 189(>H/2) → full pill.
        "rounded-full text-xl font-extrabold text-[#6b3400]",
        // 피그마 3레이어 재현:
        //   면(A, padding-box) linear-gradient(180deg,#FEC610,#E9A300)
        //   광택 테두리(B, border-box) linear-gradient(135.81deg,#FFE16A 17.76%,#EB8005 82.83%) — 4px
        //   하단 갈색 베이스(C) #7C3E00 = box-shadow 하단 림 + 드롭섀도(0 10px 20px #00000080 → 스케일).
        "border-[4px] border-transparent",
        "[background:linear-gradient(180deg,#fec610,#e9a300)_padding-box,linear-gradient(135.81deg,#ffe16a_17.76%,#eb8005_82.83%)_border-box]",
        "shadow-[0_6px_0_#7c3e00,0_4px_8px_rgba(0,0,0,0.5)]",
        // 눌림(버튼2, 주황): 면·테두리 주황 전환 + 살짝 내려앉으며 림 축소.
        "transition-all duration-100",
        "active:translate-y-[3px]",
        "active:[background:linear-gradient(180deg,#ff9028,#e95900)_padding-box,linear-gradient(135.81deg,#ffaa6a_17.76%,#eb5d05_82.83%)_border-box]",
        "active:shadow-[0_2px_0_#7c3e00,0_2px_5px_rgba(0,0,0,0.5)]",
        "disabled:opacity-50",
        className,
      ].join(" ")}
    >
      {children}
    </button>
  );
}
