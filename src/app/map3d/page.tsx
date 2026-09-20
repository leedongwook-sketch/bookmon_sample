import { Map3DScreen } from "@/features/map3d/Map3DScreen";

// 3D 지도 — 평면 지도 이미지를 지면에 깔고 카메라만 원근 틸트(react-three-fiber).
// 기존 2D 지도(/map)와 완전히 독립. 우상단 버튼으로 상호 이동.
export default function Map3DPage() {
  return <Map3DScreen />;
}
