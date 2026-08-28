import type { QuizType } from "./common";

// 태블릿 /play flow에서 받는 게임 카탈로그 타입 (API 명세 1차 기준).
// 서버가 학교(행사) → 모둠 → 게임을 3단계로 나눠 내려준다 (단일 중첩 트리 아님).
// ⚠ v0.2 예시. 기획/명세 확정 시 변경될 수 있음.

// GET /play/schools?keyword= — 학교(행사) 검색 결과 항목
export interface SchoolSearchResult {
  id: string; // 행사 ID
  place: string; // 학교명
}

// 지도 georeference 앵커 1점 — 지도 이미지 위 위치(0~1 비율)와 대응하는 실세계 GPS.
// 이런 앵커 2점이면 GPS↔이미지 좌표 변환(내 위치 표시·몬스터 투영)이 성립한다.
export interface MapAnchor {
  x: number; // 이미지 가로 비율 0(좌)~1(우)
  y: number; // 이미지 세로 비율 0(상)~1(하)
  latitude: number;
  longitude: number;
}

// GET /play/events/{eventId} — 행사 상세(지도 이미지 + GPS bbox). API 명세 확정본.
// 서버는 정북 기준 직사각형 bbox(north/south/east/west)로 지도 영역을 준다.
export interface EventDetail {
  id: string;
  place: string; // 학교명
  displayName: string; // 표시명
  eventDate: string;
  mapImageUrl: string | null; // 지도 이미지 URL (API 서버 상대경로 또는 절대)
  gps: {
    north: number; // 지도 상단 위도
    south: number; // 지도 하단 위도
    east: number; // 지도 우측 경도
    west: number; // 지도 좌측 경도
  };
  mapSize: {
    width: number; // 지도 이미지 픽셀 폭
    height: number; // 지도 이미지 픽셀 높이
  };
}

// 프론트 내부 지도 모델(배경 이미지 + georeference 2점).
// 서버 EventDetail(bbox)을 이 2앵커로 변환해서 소비한다(projectToImage/3D 좌표 재사용).
//   bbox → 앵커: NW(x=0,y=0)=(north,west), SE(x=1,y=1)=(south,east).
export interface EventMap {
  imageUrl: string; // 지도 이미지 경로 (북몬 스타일 배경)
  anchors: [MapAnchor, MapAnchor]; // 정확히 2점 (보통 대각 모서리)
}

// 3D 지도(map3d)에서 쓰는 지면 평면 좌표. 이미지 비율(projectToImage 결과)을
// three world의 XZ 평면 좌표로 변환한 값 — gameStore에 캐시해 3D 씬이 소비한다.
// (Y=위, 지면은 y=0. worldX=가로, worldZ=세로/깊이)
export interface GroundPoint {
  id: string; // 몬스터(게임) id 또는 "me"
  x: number; // 이미지 비율 0~1 (재확인/디버그용)
  y: number; // 이미지 비율 0~1
  worldX: number; // three world X
  worldZ: number; // three world Z
}

// 3D 지도 레이아웃 스냅샷 — 지면 평면 크기 + 몬스터/내 위치의 world 좌표.
// eventMap.anchors + games + 내 위치로 계산해 gameStore에 저장(3D 좌표 캐시).
export interface GroundLayout {
  planeWidth: number; // 지면 평면 가로(=1로 정규화)
  planeDepth: number; // 지면 평면 세로(=이미지 종횡비)
  monsters: GroundPoint[]; // 몬스터별 world 좌표
  me: GroundPoint; // 내 위치 world 좌표
}

// GET /play/events/{eventId}/groups — 모둠 항목
export interface PlayGroup {
  id: string; // 모둠 ID
  name: string; // 모둠명 "1조"
}

// GET /play/groups/{groupId}/games — 게임(배치) 항목 = 몬스터 + 퀴즈 + 위치
export interface Game {
  id: string;
  monster: Monster;
  quiz: Quiz;
  location: GameLocation;
}

export interface GameLocation {
  latitude: number;
  longitude: number;
}

export interface Monster {
  id: string;
  koreanName: string; // 한글명
  englishName: string; // 영문명
  codeName: string; // 코드명 (식별 키)
  thumbnail64Url: string | null;
  thumbnail128Url: string | null;
  thumbnail256Url: string | null;
  // AR 애니메이션 스프라이트 시트 (nullable)
  spriteIdleUrl: string | null; // 대기
  spriteLeftUrl: string | null; // 좌 이동
  spriteRightUrl: string | null; // 우 이동
  spriteHitUrl: string | null; // 피격
}

export interface Quiz {
  id: string;
  content: string; // 문항
  type: QuizType;
  choice1: string;
  choice2: string;
  choice3: string | null; // nullable (OX·2지선다 등)
  choice4: string | null;
  answer: number; // 정답 번호 (1~4, 1-based)
  description: string | null; // 문제 해설 (nullable)
  imageUrl: string | null; // 보조 이미지 URL (nullable)
}
