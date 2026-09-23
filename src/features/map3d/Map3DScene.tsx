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

// 지평선 파노라마 — 지도 주변에 큰 지면을 깔고 fog 로 멀리를 안개(지평선 색)로 흐려
//   내비게이션 지도처럼 '지면이 지평선으로 사라지는' 원근을 만든다. (참고 이미지)
const HAZE = "#e8ddc5"; // 지평선 안개색(따뜻한 베이지) — CSS 하늘 그라데 하단과 맞춤
const HORIZON_GROUND = "#dbe7c4"; // 서라운드 지면색(지도 잔디 톤) — 지도 밖을 채운다
const FOG_NEAR = 0.8; // 이 거리부터 안개 시작(지도 ±0.5 는 안 닿아 선명)
const FOG_FAR = 2.2; // 원판 가장자리(지평선) 부근에서 안개색으로 blend → 하늘과 부드럽게 이어짐
// 서라운드 지면 원판 반지름 = 지평선 거리(작을수록 가깝다). 정밀분석: R=2 → 지평선 화면 33%(더 내려옴).
const HORIZON_RADIUS = 2;

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
  onAzimuth,
}: {
  imageUrl: string;
  layout: GroundLayout;
  games: Game[];
  heading?: number | null; // 나침반 헤딩(연속각, 도) — null이면 북쪽 위 고정(현행)
  onMonsterTrigger?: (game: Game) => void; // ⚠ 테스트 전용(2D와 동일 취급)
  onAzimuth?: (deg: number) => void; // 드래그(오빗) 카메라 방위각(도) — 하늘 배경 동기 회전용
}) {
  // course-up 그룹의 현재 회전각(rad)을 프레임마다 공유 → 내 위치 화살표가 이를 상쇄해 화면 위 고정.
  const courseUpYRef = useRef(0);
  return (
    <Canvas
      shadows={false}
      dpr={[1, 2]}
      // ⚠ offsetSize: 세로→강제 가로회전(PortraitGuard의 CSS transform:rotate) 시 r3f 가 크기를
      //   getBoundingClientRect(회전 후 bbox=가로/세로 뒤바뀜)로 재면 종횡비가 어긋나 화면이 반쪽으로
      //   깨진다. offsetWidth/Height(레이아웃 크기, transform 영향 없음)로 측정하게 해 정상 렌더.
      resize={{ offsetSize: true }}
      // 컨텍스트 안정화: 성능 우선 + 성능저하(소프트웨어 렌더러)에도 컨텍스트 생성 허용.
      gl={{ powerPreference: "high-performance", failIfMajorPerformanceCaveat: false }}
      // 초기 카메라 — 높이↓·수평거리↑ 로 눕혀(약 60°) 비스듬히 바라본다(기존 45° 대비 더 낮은 시점).
      camera={{ position: [0, 0.28, 0.5], fov: 45, near: 0.01, far: 100 }}
      className="h-full w-full"
    >
      {/* WebGL 컨텍스트 lost/restored 처리 — StrictMode 이중마운트/컨텍스트 한도 초과로
          컨텍스트가 죽어도 흰 화면 대신 복구 후 재렌더되게 한다. */}
      <ContextLossGuard />

      {/* 지평선 안개 — 멀리 있는 서라운드 지면을 안개색으로 흐려 지평선을 만든다.
          지도/마커는 fog={false}(선명), 서라운드 지면만 fog 적용. */}
      <fog attach="fog" args={[HAZE, FOG_NEAR, FOG_FAR]} />

      {/* 서라운드 지면 — 지도 밖을 원판으로 채운다. 원판 '반지름'이 곧 지평선 거리(작을수록 가깝다).
          fog 가 화면 지평선을 지배하지 못해(셰이더 미반영), geometry(원 반지름)로 직접 제어한다.
          원(circle)이라 드래그 회전 시 각진 모서리 없음. 가장자리는 fog(작동 시)로 부드럽게 blend.
          월드 고정(드래그로 안 돎), 지도(y=0)보다 살짝 아래(y=-0.001)로 z-fighting 방지. */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.001, 0]}>
        <circleGeometry args={[HORIZON_RADIUS, 64]} />
        <meshBasicMaterial color={HORIZON_GROUND} toneMapped={false} />
      </mesh>

      {/* 조명 — GLB 책 모델(MeshStandard)만 반응(지면·마커는 meshBasic이라 무관).
          책이 어두워 보여 앰비언트↑ + 주광·반대쪽 채움광으로 그늘을 밝게 띄운다. */}
      <ambientLight intensity={1.55} />
      <directionalLight position={[1, 2, 1]} intensity={0.8} />
      <directionalLight position={[-1, 1.5, -1]} intensity={0.35} />

      {/* 텍스처(SVG 지면)·폰트(Text) 비동기 로드 중 상위로 suspend가 새지 않게 경계. */}
      <Suspense fallback={null}>
        {/* 지도는 고정(북쪽 위) — course-up(휴대폰 방향으로 지도 회전) 비활성이라 heading={null}.
            대신 내 위치 화살표만 heading 으로 회전해 방향을 가리킨다(아래 MyMarker). */}
        <CourseUpGroup heading={null} yRef={courseUpYRef}>
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

          {/* 내 위치 마커 — 화살표가 heading 으로 회전해 방향을 가리킨다(지도는 고정). */}
          <MyMarker point={layout.me} heading={heading} />
        </CourseUpGroup>
      </Suspense>

      {/* 드래그=오빗 회전(yaw) + 원근 틸트. 줌 허용, 팬 비활성(중심 고정).
          onChange: 드래그로 카메라 방위각이 바뀌면 도(deg)로 부모에 알려 하늘 배경을 같이 회전시킨다. */}
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
      {/* 드래그(오빗) 방위각을 매 프레임 폴링해 하늘 배경에 전달 — onChange 보다 확실·부드러움. */}
      {onAzimuth && <AzimuthReporter onAzimuth={onAzimuth} />}
    </Canvas>
  );
}

// course-up 회전 그룹 — 헤딩(시계방향, 도)에 맞춰 지면 전체를 반대로 돌린다.
//   Y축 +회전은 위에서 볼 때 반시계 = 내 진행방향(시계방향 heading)을 화면 위(-Z)로 보냄.
//   heading은 연속각(unwrap)이라 359↔0 경계에서도 목표각이 이어져 한 바퀴 도는 튐이 없고,
//   프레임마다 지수 감쇠로 부드럽게 보간한다. null(데스크톱/센서 없음)이면 북쪽 위(0) 유지.
function CourseUpGroup({
  heading,
  yRef,
  children,
}: {
  heading: number | null;
  yRef: React.RefObject<number>; // 현재 회전각(rad)을 프레임마다 기록 → 화살표 상쇄용
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
    yRef.current = g.rotation.y; // 화살표(MyMarker)가 이 값을 상쇄해 화면 위 고정
  });

  return <group ref={groupRef}>{children}</group>;
}

// 드래그(오빗) 방위각 리포터 — makeDefault OrbitControls 를 useThree 로 읽어 매 프레임 방위각을 폴링.
//   첫 값을 기준(0)으로 삼고(초기 카메라 azimuth ~180° 보정), 연속각(unwrap)으로 누적해
//   경계 360° 튐 없이 '변화량(도)'만 부모(하늘 배경)에 전달한다. 변화가 있을 때만 emit.
function AzimuthReporter({ onAzimuth }: { onAzimuth: (deg: number) => void }) {
  const controls = useThree((s) => s.controls) as
    | { getAzimuthalAngle?: () => number }
    | null;
  const unwrapRef = useRef<number | null>(null);
  const baseRef = useRef(0);

  useFrame(() => {
    if (!controls?.getAzimuthalAngle) return;
    const raw = THREE.MathUtils.radToDeg(controls.getAzimuthalAngle()); // -180~180
    const prev = unwrapRef.current;
    if (prev === null) {
      unwrapRef.current = raw;
      baseRef.current = raw; // 첫 값 = 기준(0)
    } else {
      const prevMod = ((prev % 360) + 360) % 360;
      let diff = raw - prevMod;
      diff = (((diff % 360) + 540) % 360) - 180; // 최단경로(-180~180)
      unwrapRef.current = prev + diff;
    }
    // 매 프레임 즉시 전달 — 수신부가 DOM 직접 갱신(React 우회)이라 스로틀 불필요.
    onAzimuth(unwrapRef.current - baseRef.current);
  });

  return null;
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
      {/* rotateX(-90°) 후 geometry의 (x,y)가 world (x,z)로 매핑됨. fog={false}: 지도는 안개 면제(선명). */}
      <planeGeometry args={[layout.planeWidth, layout.planeDepth]} />
      <meshBasicMaterial map={texture} color={GROUND_TINT} toneMapped={false} fog={false} />
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

// 내 위치 마커 — 파란 레이더 번짐(지면 확장) + 내비게이션 화살표 마커 이미지(지면에 수평).
//   지도는 고정(course-up 미사용)이고, 화살표만 나침반 heading 에 맞춰 Y축으로 회전해 방향을 가리킨다.
//   heading null(센서 없음/데스크톱)이면 화면 위(북쪽) 고정.
function MyMarker({
  point,
  heading,
}: {
  point: GroundPoint;
  heading: number | null;
}) {
  const texture = useTexture("/images/mk_player.png");
  const radarRef = useRef<THREE.Mesh>(null);
  const arrowRef = useRef<THREE.Group>(null); // 화살표 회전 그룹(heading 반영)

  useFrame(({ clock }) => {
    // 레이더 번짐: 지면 원이 중심에서 퍼지며 사라지는 것을 반복(2D animate-ping과 동일 감).
    const m = radarRef.current;
    if (m) {
      const t = (clock.getElapsedTime() % 1.6) / 1.6; // 0..1 루프
      m.scale.setScalar(1 + t * 2.4); // 확장
      (m.material as THREE.MeshBasicMaterial).opacity = 0.4 * (1 - t); // 페이드아웃
    }
    // 화살표를 heading(시계방향, 도)에 맞춰 Y축 회전 → 지면 위에서 진행방향을 가리킨다.
    //   지도 평면상 -Z(화면 위)가 북쪽 기준. heading 시계방향 → Y축 -회전. 지수감쇠로 부드럽게.
    const a = arrowRef.current;
    if (a && heading !== null) {
      const target = -THREE.MathUtils.degToRad(heading);
      a.rotation.y += (target - a.rotation.y) * 0.2;
    }
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
      {/* 화살표 — 지면과 평행(수평)으로 눕힘. arrowRef 그룹이 heading 만큼 Y축 회전해 방향을 가리킨다.
          rotation X=-90° 로 눕히면 이미지 위쪽(tip)이 -Z(북쪽/진행방향)를 향한다.
          레이더 원(y=0.003)과 거의 같은 높이(y=0.0032)에 둬 카메라를 눕혀도 중심이 어긋나 보이지 않게. */}
      <group ref={arrowRef}>
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.0032, 0]}>
          <planeGeometry args={[0.045, 0.047]} />
          <meshBasicMaterial
            map={texture}
            transparent
            toneMapped={false}
            depthWrite={false}
          />
        </mesh>
      </group>
    </group>
  );
}

export default Map3DScene;
