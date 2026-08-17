import type { ButtonHTMLAttributes } from "react";
import { ASSETS } from "@/constants/assets";

/**
 * 온보딩 CTA 버튼 — next_button.svg의 프레임(글자 제거본)을 배경으로 쓰고,
 * 라벨은 코드가 얹는다. 다음/뒤로/검색 중… 등 어떤 문구든 같은 프레임을 공유한다.
 * 벡터라 확대해도 안 깨짐. 갈색 글씨(#6b3400)는 원본 baked 라벨색과 동일.
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
      style={{
        backgroundImage: `url(${ASSETS.btnFrame})`,
        backgroundSize: "100% 100%",
        backgroundRepeat: "no-repeat",
      }}
      className={`flex h-12 w-[150px] items-center justify-center whitespace-nowrap text-lg font-extrabold text-[#6b3400] transition-transform duration-100 active:translate-y-[2px] disabled:opacity-50 ${className}`}
    >
      {children}
    </button>
  );
}
