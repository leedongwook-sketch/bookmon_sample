import { AppEntry } from "@/features/onboarding/AppEntry";

// 앱 진입 = 공통 게이트(AppEntry).
// localStorage 검사 → 정상 게임데이터면 /map, 아니면 BM-101 모드선택.
export default function Home() {
  return <AppEntry />;
}
