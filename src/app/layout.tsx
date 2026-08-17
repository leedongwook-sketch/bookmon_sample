import type { Metadata, Viewport } from "next";
import { Jua } from "next/font/google";
import "./globals.css";
import { Providers } from "@/providers";

// 아이들이 좋아할 둥글둥글한 한글 폰트 (주아체). CJK라 preload 끔.
const jua = Jua({
  weight: "400",
  subsets: ["latin"], // Jua는 latin 서브셋 파일에 한글 글리프가 포함됨
  variable: "--font-jua",
  display: "swap",
  preload: false,
});

export const metadata: Metadata = {
  title: "북몬 (BOOKMON)",
  description: "책 속 북몬을 찾아라! — 위치기반 AR 독서 활동 게임",
  // iOS Safari "홈 화면에 추가" 시 전체화면(standalone) 실행 + 상태바 처리
  appleWebApp: {
    capable: true,
    title: "북몬",
    statusBarStyle: "black-translucent",
  },
};

// 가로모드 기본, 세로에서도 왜곡 없이 렌더되도록 반응형 뷰포트 설정.
// viewportFit=cover → 노치/홈바 대응(safe-area). userScalable=false → 앱 느낌(핀치 확대 방지).
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  themeColor: "#8B5A2B",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    // suppressHydrationWarning: 외부(확장/인앱 브라우저 등)가 <html>/<body>에 주입하는
    // 속성(예: __gcrremoteframetoken)으로 인한 하이드레이션 경고 억제 — 콘텐츠 검증엔 영향 없음.
    <html
      lang="ko"
      suppressHydrationWarning
      className={`h-full antialiased ${jua.variable}`}
    >
      <body
        suppressHydrationWarning
        className="min-h-[100dvh] overflow-x-hidden bg-background text-foreground"
      >
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
