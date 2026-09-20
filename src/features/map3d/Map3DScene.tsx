"use client";

import { Suspense, useEffect, useMemo, useRef } from "react";
import { Canvas, useThree, useFrame } from "@react-three/fiber";
import { Billboard, OrbitControls, useTexture, useGLTF } from "@react-three/drei";
import * as THREE from "three";
import type { Game, GroundLayout, GroundPoint } from "@/types";

// 3D 지도 씬 — 평면 지도 이미지를 지면(land)에 깔고, 공간(카메라)만 원근 틸트.
//  - 건물을 돌출시키지 않는다(이미지 그대로 평면). 샘플(3d_map_sample.png) 스타일.
//  - 드래그로 시점(오빗) 회전 + 원근 유지. polar 제한으로 지면 아래로 뒤집히지 않음.
//  - 몬스터=책 3D 모델(GLB), 내 위치=지면 위 빌보드 마커(항상 카메라를 향함).

// ── 디자인 토큰(three는 CSS 변수를 못 읽어 hex 상수로 미러) ──
const SKYBLUE = "#019cf4";
const GROUND_TINT = "#fff6e1"; // 아이보리 — 지면 살짝 밝게

// 카메라 틸트/오빗 제한 (지면 아래로 뒤집히지 않게)
const MIN_POLAR = Math.PI / 6; // 위에서 30° 이상 눕히지 않음(너무 top-down 방지)
const MAX_POLAR = Math.PI / 2.6; // 지면 아래로 못 감(수평 근처에서 멈춤)

// 몬스터 책 3D 모델 — /images 하위에 둬야 배포 시 gh-pages-rewrite 가 basePath 를 접두한다.
//   (rewrite 는 따옴표 안 "/images/·/ar/" 리터럴만 처리 — scripts/gh-pages-rewrite.mjs)
//   비압축 GLB(Draco/meshopt 없음)라 별도 디코더 불필요. 7.3MB 로 커서 모듈 로드 즉시 프리페치.
const BOOK_GLB_URL = "/images/mk_book.glb";
useGLTF.preload(BOOK_GLB_URL);
// 모델 최대 치수를 이 크기(world)로 정규화 — 기존 빌보드 마커(0.06×0.056)와 비슷한 스케일.
const BOOK_TARGET_SIZE = 0.06;

/** Canvas + 씬. gameStore에서 계산·저장된 GroundLayout을 소비해 렌더한다. */
export function Map3DScene({
  imageUrl,
  layout,
  games,
  heading = null,
  onMonsterTrigger,
}: {
  imageUrl: string;
  layout: GroundLayout;
  games: Game[];
  heading?: number | null; // 나침반 헤딩(연속각, 도) — null이면 북쪽 위 고정(현행)
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

      {/* 조명 — GLB 책 모델(MeshStandard)만 반응(지면·마커는 meshBasic이라 무관).
          책이 어두워 보여 앰비언트↑ + 주광·반대쪽 채움광으로 그늘을 밝게 띄운다. */}
      <ambientLight intensity={1.55} />
      <directionalLight position={[1, 2, 1]} intensity={0.8} />
      <directionalLight position={[-1, 1.5, -1]} intensity={0.35} />

      {/* 텍스처(SVG 지면)·폰트(Text) 비동기 로드 중 상위로 suspend가 새지 않게 경계. */}
      <Suspense fallback={null}>
        {/* course-up: 지면+마커를 헤딩 반대로 회전 → 내가 보는 방향이 항상 화면 위.
            마커는 빌보드(항상 카메라를 향함)라 배경과 함께 돌려도 위치만 바뀌고 이미지는 안 기운다. */}
        <CourseUpGroup heading={heading}>
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
        </CourseUpGroup>
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

// course-up 회전 그룹 — 헤딩(시계방향, 도)에 맞춰 지면 전체를 반대로 돌린다.
//   Y축 +회전은 위에서 볼 때 반시계 = 내 진행방향(시계방향 heading)을 화면 위(-Z)로 보냄.
//   heading은 연속각(unwrap)이라 359↔0 경계에서도 목표각이 이어져 한 바퀴 도는 튐이 없고,
//   프레임마다 지수 감쇠로 부드럽게 보간한다. null(데스크톱/센서 없음)이면 북쪽 위(0) 유지.
function CourseUpGroup({
  heading,
  children,
}: {
  heading: number | null;
  children: React.ReactNode;
}) {
  const groupRef = useRef<THREE.Group>(null);
  const targetRef = useRef(0); // 목표 yaw(라디안). heading null이면 0(북쪽 위) 고정.

  useEffect(() => {
    if (heading !== null) targetRef.current = THREE.MathUtils.degToRad(heading);
  }, [heading]);

  useFrame((_, delta) => {
    const g = groupRef.current;
    if (!g) return;
    // 지수 감쇠 보간 — 프레임레이트와 무관하게 일정한 감(계수 6/s).
    g.rotation.y += (targetRef.current - g.rotation.y) * Math.min(1, delta * 6);
  });

  return <group ref={groupRef}>{children}</group>;
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

// 몬스터 마커 — 발밑 그림자 + 책 3D 모델(MK_BOOK.glb) 둥둥 float.
//   GLB(7.3MB) 다운로드 동안엔 스냅샷 빌보드 폴백으로 빈 자리를 막는다.
function MonsterMarker({
  point,
  onTrigger,
}: {
  point: GroundPoint;
  onTrigger?: () => void;
}) {
  const floatRef = useRef<THREE.Group>(null);
  // 마커마다 위상을 다르게(worldX 기반) → 동시에 안 흔들려 자연스러움.
  const phase = point.worldX * 12;

  // 위아래 둥둥 — 책(모델/폴백)만 y로 부드럽게 오르내림. 발밑 정렬이라 살짝 띄운다.
  useFrame(({ clock }) => {
    if (floatRef.current) {
      floatRef.current.position.y =
        0.015 + Math.sin(clock.getElapsedTime() * 2.4 + phase) * 0.008;
    }
  });

  return (
    <group position={[point.worldX, 0, point.worldZ]}>
      {/* 바닥 그림자 — 지면에 고정(책과 함께 안 움직임). 타원처럼 납작하게. */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.002, 0]} scale={[1, 0.5, 1]}>
        <circleGeometry args={[0.025, 32]} />
        <meshBasicMaterial color="#12213a" transparent opacity={0.16} depthWrite={false} />
      </mesh>

      {/* 책 3D 모델 — 둥둥 float(그림자와 분리). 로딩 중엔 스냅샷 빌보드 폴백. */}
      <group ref={floatRef} position={[0, 0.015, 0]}>
        <Suspense fallback={<BookSpriteFallback onTrigger={onTrigger} />}>
          <BookModel onTrigger={onTrigger} />
        </Suspense>
      </group>
    </group>
  );
}

// 책 3D 모델 — GLB 씬을 마커별로 클론해 크기 정규화(최대 치수=BOOK_TARGET_SIZE) 후
// 바닥(min.y)이 그룹 원점에 오게 발밑 정렬한다(모델 원 단위·원점과 무관하게 일정).
function BookModel({ onTrigger }: { onTrigger?: () => void }) {
  const { scene } = useGLTF(BOOK_GLB_URL);
  const book = useMemo(() => {
    const obj = scene.clone(true);
    // 책이 어두워 보이는 문제 보정 — 조명만으론 부족할 수 있어 재질도 살짝 밝힌다.
    //   금속성↓·거칠기 확보(무광)로 앰비언트 반응↑ + base color 기반 약한 emissive 로 그늘 리프트.
    obj.traverse((o) => {
      const mesh = o as THREE.Mesh;
      const mat = mesh.material as THREE.MeshStandardMaterial | undefined;
      if (mat && "metalness" in mat) {
        mat.metalness = Math.min(mat.metalness ?? 0, 0.05);
        mat.roughness = Math.max(mat.roughness ?? 1, 0.9);
        if (mat.color && mat.emissive) {
          mat.emissive.copy(mat.color);
          mat.emissiveIntensity = 0.08; // 어두운 면을 base color 로 아주 은은히만 띄움
        }
        mat.needsUpdate = true;
      }
    });
    const box = new THREE.Box3().setFromObject(obj);
    const size = box.getSize(new THREE.Vector3());
    const s = BOOK_TARGET_SIZE / (Math.max(size.x, size.y, size.z) || 1);
    obj.scale.setScalar(s);
    obj.position.y = -box.min.y * s;
    return obj;
  }, [scene]);

  return (
    <group
      onPointerDown={
        onTrigger
          ? (e) => {
              e.stopPropagation();
              onTrigger();
            }
          : undefined
      }
    >
      <primitive object={book} />
    </group>
  );
}

// GLB 로딩 폴백 — 2D 마커와 동일한 책 스냅샷(mk_book.png) 빌보드.
//   스냅샷 비율 170:256 에 맞춰 높이 0.056(기존 마커 스케일) 기준 폭 산출.
function BookSpriteFallback({ onTrigger }: { onTrigger?: () => void }) {
  const texture = useTexture("/images/mk_book.png", (t) => {
    t.colorSpace = THREE.SRGBColorSpace; // 색 정확
    t.anisotropy = 8; // 기울어진 각도에서도 선명
    t.minFilter = THREE.LinearMipmapLinearFilter;
    t.magFilter = THREE.LinearFilter;
    t.generateMipmaps = true;
    t.needsUpdate = true;
  });

  return (
    <Billboard position={[0, 0.028, 0]}>
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
        <planeGeometry args={[0.056 * (170 / 256), 0.056]} />
        <meshBasicMaterial
          map={texture}
          transparent
          toneMapped={false}
          depthWrite={false}
        />
      </mesh>
    </Billboard>
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
        <circleGeometry args={[0.015, 40]} />
        <meshBasicMaterial
          color={SKYBLUE}
          transparent
          opacity={0.4}
          depthWrite={false}
        />
      </mesh>
      {/* 화살표 마커 이미지 — 항상 카메라를 향함 */}
      <Billboard position={[0, 0.03, 0]}>
        <mesh>
          <planeGeometry args={[0.045, 0.047]} />
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
