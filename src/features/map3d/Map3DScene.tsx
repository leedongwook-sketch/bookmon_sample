"use client";

import { Suspense, useEffect, useRef } from "react";
import { Canvas, useThree, useFrame } from "@react-three/fiber";
import { Billboard, OrbitControls, useTexture } from "@react-three/drei";
import * as THREE from "three";
import type { Game, GroundLayout, GroundPoint } from "@/types";

// 3D 지도 씬 — 평면 지도 이미지를 지면(land)에 깔고, 공간(카메라)만 원근 틸트.
//  - 건물을 돌출시키지 않는다(이미지 그대로 평면). 샘플(3d_map_sample.png) 스타일.
//  - 드래그로 시점(오빗) 회전 + 원근 유지. polar 제한으로 지면 아래로 뒤집히지 않음.
//  - 몬스터/내 위치는 지면 위 빌보드 마커(항상 카메라를 향함).

// ── 디자인 토큰(three는 CSS 변수를 못 읽어 hex 상수로 미러) ──
const SKYBLUE = "#019cf4";
const GROUND_TINT = "#fff6e1"; // 아이보리 — 지면 살짝 밝게

// 카메라 틸트/오빗 제한 (지면 아래로 뒤집히지 않게)
const MIN_POLAR = Math.PI / 6; // 위에서 30° 이상 눕히지 않음(너무 top-down 방지)
const MAX_POLAR = Math.PI / 2.6; // 지면 아래로 못 감(수평 근처에서 멈춤)

/** Canvas + 씬. gameStore에서 계산·저장된 GroundLayout을 소비해 렌더한다. */
export function Map3DScene({
  imageUrl,
  layout,
  games,
  onMonsterTrigger,
}: {
  imageUrl: string;
  layout: GroundLayout;
  games: Game[];
  onMonsterTrigger?: (game: Game) => void; // ⚠ 테스트 전용(2D와 동일 취급)
}) {
  return (
    <Canvas
      shadows={false}
      dpr={[1, 2]}
      // 컨텍스트 안정화: 성능 우선 + 성능저하(소프트웨어 렌더러)에도 컨텍스트 생성 허용.
      gl={{ powerPreference: "high-performance", failIfMajorPerformanceCaveat: false }}
      camera={{ position: [0, 0.4, 0.4], fov: 45, near: 0.01, far: 100 }}
      className="h-full w-full"
    >
      {/* WebGL 컨텍스트 lost/restored 처리 — StrictMode 이중마운트/컨텍스트 한도 초과로
          컨텍스트가 죽어도 흰 화면 대신 복구 후 재렌더되게 한다. */}
      <ContextLossGuard />

      {/* 부드러운 전역광 — 색면이 납작하지 않게 약간의 방향광 */}
      <ambientLight intensity={1.1} />
      <directionalLight position={[1, 2, 1]} intensity={0.5} />

      {/* 텍스처(SVG 지면)·폰트(Text) 비동기 로드 중 상위로 suspend가 새지 않게 경계. */}
      <Suspense fallback={null}>
        <Ground imageUrl={imageUrl} layout={layout} />

        {/* 몬스터 마커 */}
        {layout.monsters.map((p) => {
          const game = games.find((g) => g.id === p.id);
          if (!game) return null;
          return (
            <MonsterMarker
              key={p.id}
              point={p}
              onTrigger={onMonsterTrigger ? () => onMonsterTrigger(game) : undefined}
            />
          );
        })}

        {/* 내 위치 마커 */}
        <MyMarker point={layout.me} />
      </Suspense>

      {/* 드래그=오빗 회전(yaw) + 원근 틸트. 줌 허용, 팬 비활성(중심 고정). */}
      <OrbitControls
        makeDefault
        enablePan={false}
        enableDamping
        dampingFactor={0.12}
        minPolarAngle={MIN_POLAR}
        maxPolarAngle={MAX_POLAR}
        minDistance={0.6}
        maxDistance={2.5}
        target={[0, 0, 0]}
      />
    </Canvas>
  );
}

// WebGL 컨텍스트 lost/restored 가드 (Canvas 내부에서만 동작).
//  - lost: preventDefault()로 브라우저 기본 동작을 막아 restored 이벤트를 받을 수 있게 한다.
//  - restored: invalidate()로 한 프레임 강제 렌더 → 화면 복구.
function ContextLossGuard() {
  const gl = useThree((s) => s.gl);
  const invalidate = useThree((s) => s.invalidate);

  useEffect(() => {
    const canvas = gl.domElement;

    const onLost = (e: Event) => {
      e.preventDefault(); // 필수: 막지 않으면 restored가 안 온다.
    };
    const onRestored = () => {
      invalidate(); // 컨텍스트 복구 후 재렌더.
    };

    canvas.addEventListener("webglcontextlost", onLost as EventListener, false);
    canvas.addEventListener("webglcontextrestored", onRestored as EventListener, false);
    return () => {
      canvas.removeEventListener("webglcontextlost", onLost as EventListener, false);
      canvas.removeEventListener("webglcontextrestored", onRestored as EventListener, false);
    };
  }, [gl, invalidate]);

  return null;
}

// 지면 — 지도 이미지를 텍스처로 입힌 평면. XZ 평면(y=0)에 눕힌다.
function Ground({ imageUrl, layout }: { imageUrl: string; layout: GroundLayout }) {
  // useTexture의 config 콜백에서 텍스처를 구성한다(훅 반환값을 사후 변형하지 않음).
  const texture = useTexture(imageUrl, (t) => {
    const tex = t as THREE.Texture;
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 8;
  });

  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]}>
      {/* rotateX(-90°) 후 geometry의 (x,y)가 world (x,z)로 매핑됨 */}
      <planeGeometry args={[layout.planeWidth, layout.planeDepth]} />
      <meshBasicMaterial map={texture} color={GROUND_TINT} toneMapped={false} />
    </mesh>
  );
}

// 몬스터 마커 — 발밑 골드 발광 디스크 + 빌보드 토큰(골드 원 + 네이비 링).
function MonsterMarker({
  point,
  onTrigger,
}: {
  point: GroundPoint;
  onTrigger?: () => void;
}) {
  // 3D는 SVG 원본크기(112px) 래스터화로 확대 시 깨져 → 고해상 PNG(512px) + 필터링 설정.
  const texture = useTexture("/images/mk_monster@3d.png", (t) => {
    t.colorSpace = THREE.SRGBColorSpace; // 색 정확
    t.anisotropy = 8; // 기울어진 각도에서도 선명
    t.minFilter = THREE.LinearMipmapLinearFilter;
    t.magFilter = THREE.LinearFilter;
    t.generateMipmaps = true;
    t.needsUpdate = true;
  });
  const floatRef = useRef<THREE.Group>(null);
  // 마커마다 위상을 다르게(worldX 기반) → 동시에 안 흔들려 자연스러움.
  const phase = point.worldX * 12;

  // 위아래 둥둥 — 책 빌보드만 y로 부드럽게 오르내림.
  useFrame(({ clock }) => {
    if (floatRef.current) {
      floatRef.current.position.y =
        0.075 + Math.sin(clock.getElapsedTime() * 2.4 + phase) * 0.014;
    }
  });

  return (
    <group position={[point.worldX, 0, point.worldZ]}>
      {/* 바닥 그림자 — 지면에 고정(책과 함께 안 움직임). 타원처럼 납작하게. */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.002, 0]} scale={[1, 0.5, 1]}>
        <circleGeometry args={[0.05, 32]} />
        <meshBasicMaterial color="#12213a" transparent opacity={0.16} depthWrite={false} />
      </mesh>

      {/* 책 마커 이미지 — 항상 카메라를 향함 + 둥둥 float (그림자와 분리) */}
      <Billboard ref={floatRef} position={[0, 0.075, 0]}>
        <mesh
          onPointerDown={
            onTrigger
              ? (e) => {
                  e.stopPropagation();
                  onTrigger();
                }
              : undefined
          }
        >
          <planeGeometry args={[0.13, 0.099]} />
          <meshBasicMaterial
            map={texture}
            transparent
            toneMapped={false}
            depthWrite={false}
          />
        </mesh>
      </Billboard>
    </group>
  );
}

// 내 위치 마커 — 파란 레이더 번짐(지면 확장) + 내비게이션 화살표 마커 이미지(빌보드).
function MyMarker({ point }: { point: GroundPoint }) {
  const texture = useTexture("/images/mk_player.png");
  const radarRef = useRef<THREE.Mesh>(null);

  // 레이더 번짐: 지면 원이 중심에서 퍼지며 사라지는 것을 반복(2D animate-ping과 동일 감).
  useFrame(({ clock }) => {
    const m = radarRef.current;
    if (!m) return;
    const t = (clock.getElapsedTime() % 1.6) / 1.6; // 0..1 루프
    m.scale.setScalar(1 + t * 2.4); // 확장
    (m.material as THREE.MeshBasicMaterial).opacity = 0.4 * (1 - t); // 페이드아웃
  });

  return (
    <group position={[point.worldX, 0, point.worldZ]}>
      {/* 파란 레이더 번짐(지면) */}
      <mesh ref={radarRef} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.003, 0]}>
        <circleGeometry args={[0.03, 40]} />
        <meshBasicMaterial
          color={SKYBLUE}
          transparent
          opacity={0.4}
          depthWrite={false}
        />
      </mesh>
      {/* 화살표 마커 이미지 — 항상 카메라를 향함 */}
      <Billboard position={[0, 0.05, 0]}>
        <mesh>
          <planeGeometry args={[0.09, 0.0945]} />
          <meshBasicMaterial
            map={texture}
            transparent
            toneMapped={false}
            depthWrite={false}
          />
        </mesh>
      </Billboard>
    </group>
  );
}

export default Map3DScene;
