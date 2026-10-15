/**
 * 3D scene for the coronary heart viewer. Loaded lazily by `CoronaryHeartViewer` so that three.js,
 * react-three-fiber and the GLB are not part of the initial page bundle.
 *
 * Geometry: Human Reference Atlas v1.3 Heart + Blood Vasculature (female), CC BY 4.0 – see
 * docs/asset-attribution.md. LAD / LCX / RCA are separate named meshes in that asset.
 */
import { Html, OrbitControls, useGLTF } from '@react-three/drei';
import { Canvas, useFrame, useThree, type ThreeEvent } from '@react-three/fiber';
import { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import {
  CORONARY_KEYS,
  HEART_ASSET_URL,
  VESSEL_META,
  classifyNode,
  formatPercent,
  type CoronaryKey,
  type RiskBand,
  type StructureKey,
  type VesselReading,
} from '../../lib/heartAnatomy';

export type ViewCommand = {
  id: number;
  type: 'reset' | 'front' | 'back' | 'left' | 'right' | 'top' | 'zoomIn' | 'zoomOut' | 'rotL' | 'rotR' | 'rotU' | 'rotD';
};

type SceneProps = {
  readings: Record<CoronaryKey, VesselReading>;
  selected: StructureKey | null;
  onSelect: (key: StructureKey | null) => void;
  command: ViewCommand | null;
  onFailure: (reason: string) => void;
  onReady: () => void;
};

const TARGET_SIZE = 4; // model is normalised so its largest dimension is this many scene units
const DEFAULT_DIR = new THREE.Vector3(0.12, 0.1, 1).normalize();
const FOV = 34;

export const BAND_COLOR: Record<RiskBand | 'none', string> = {
  lower: '#22d3ee',
  intermediate: '#fbbf24',
  higher: '#fb7185',
  none: '#8aa4bd',
};

type MaterialSet = {
  chambers: THREE.ShaderMaterial;
  great: THREE.ShaderMaterial;
  veins: THREE.ShaderMaterial;
  internal: THREE.MeshStandardMaterial;
  unassigned: THREE.MeshStandardMaterial;
  coronary: Record<CoronaryKey, THREE.MeshStandardMaterial>;
};

const VERT = /* glsl */ `
  varying vec3 vN;
  varying vec3 vV;
  void main() {
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    vN = normalize(normalMatrix * normal);
    vV = normalize(-mv.xyz);
    gl_Position = projectionMatrix * mv;
  }
`;

// Fresnel "medical hologram" shading: dark body, luminous cyan rim, soft key-light form.
const FRAG = /* glsl */ `
  uniform vec3 uBase;
  uniform vec3 uRim;
  uniform float uAlpha;
  uniform float uPower;
  uniform float uBoost;
  varying vec3 vN;
  varying vec3 vV;
  void main() {
    vec3 n = normalize(vN);
    if (!gl_FrontFacing) n = -n;
    float ndv = clamp(dot(n, normalize(vV)), 0.0, 1.0);
    float fres = pow(1.0 - ndv, uPower);
    float key = max(dot(n, normalize(vec3(-0.35, 0.65, 0.7))), 0.0);
    vec3 col = uBase * (0.35 + 0.9 * key) + uRim * fres * (0.9 + uBoost) + uRim * 0.06 * uBoost;
    gl_FragColor = vec4(col, clamp(uAlpha + fres * (1.0 - uAlpha), 0.0, 1.0));
  }
`;

function makeRim(base: string, rim: string, alpha: number, power: number): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: {
      uBase: { value: new THREE.Color(base) },
      uRim: { value: new THREE.Color(rim) },
      uAlpha: { value: alpha },
      uPower: { value: power },
      uBoost: { value: 0 },
    },
    vertexShader: VERT,
    fragmentShader: FRAG,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
}

function makeCoronary(): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({ color: BAND_COLOR.none, roughness: 0.32, metalness: 0.15 });
}

function createMaterials(): MaterialSet {
  return {
    chambers: makeRim('#0b3558', '#3fe6ff', 0.62, 2.1),
    great: makeRim('#0d4068', '#69c4ff', 0.7, 2.0),
    veins: makeRim('#082c4a', '#2f86d8', 0.5, 2.0),
    internal: new THREE.MeshStandardMaterial({
      color: '#7fb9e0',
      roughness: 0.6,
      transparent: true,
      opacity: 0.22,
      depthWrite: false,
    }),
    unassigned: new THREE.MeshStandardMaterial({ color: '#9bb7d1', emissive: '#4f7fa8', emissiveIntensity: 0.55, roughness: 0.4 }),
    coronary: { lad: makeCoronary(), lcx: makeCoronary(), rca: makeCoronary() },
  };
}

type Built = {
  root: THREE.Object3D;
  scale: number;
  radius: number;
  anchors: Partial<Record<CoronaryKey, THREE.Vector3>>;
  meshes: {
    chambers: THREE.Mesh[];
    great: THREE.Mesh[];
    veins: THREE.Mesh[];
    internal: THREE.Mesh[];
    unassigned: THREE.Mesh[];
    coronary: Record<CoronaryKey, THREE.Mesh[]>;
  };
};

function nodeNameOf(obj: THREE.Object3D): string {
  let cur: THREE.Object3D | null = obj;
  while (cur) {
    if (cur.name && cur.name.startsWith('VH_F_')) return cur.name;
    cur = cur.parent;
  }
  return obj.name;
}

function buildModel(source: THREE.Object3D, materials: MaterialSet): Built {
  const root = source.clone(true);
  const meshes: Built['meshes'] = {
    chambers: [],
    great: [],
    veins: [],
    internal: [],
    unassigned: [],
    coronary: { lad: [], lcx: [], rca: [] },
  };

  root.traverse((obj) => {
    const mesh = obj as THREE.Mesh;
    if (!mesh.isMesh) return;
    const cls = classifyNode(nodeNameOf(mesh));
    mesh.userData.nodeName = nodeNameOf(mesh);
    switch (cls.kind) {
      case 'coronary':
        mesh.material = materials.coronary[cls.vessel];
        mesh.userData.structure = cls.vessel;
        mesh.renderOrder = 3;
        meshes.coronary[cls.vessel].push(mesh);
        break;
      case 'coronary_unassigned':
        mesh.material = materials.unassigned;
        mesh.renderOrder = 3;
        meshes.unassigned.push(mesh);
        break;
      case 'chambers':
        mesh.material = materials.chambers;
        mesh.userData.structure = 'chambers';
        mesh.renderOrder = 1;
        meshes.chambers.push(mesh);
        break;
      case 'great_vessels':
        mesh.material = materials.great;
        mesh.userData.structure = 'great_vessels';
        mesh.renderOrder = 1;
        meshes.great.push(mesh);
        break;
      case 'veins':
        mesh.material = materials.veins;
        mesh.renderOrder = 1;
        meshes.veins.push(mesh);
        break;
      default:
        mesh.material = materials.internal;
        mesh.renderOrder = 2;
        meshes.internal.push(mesh);
    }
  });

  root.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(root);
  const center = box.getCenter(new THREE.Vector3());
  const size = box.getSize(new THREE.Vector3());
  const maxDim = Math.max(size.x, size.y, size.z) || 1;
  const scale = TARGET_SIZE / maxDim;
  root.position.sub(center);
  root.updateMatrixWorld(true);

  // Label anchors: a real vertex on each artery (its end farthest from the aortic root), so a label always
  // sits on the vessel it names and the three labels are spread apart.
  const aorta = root.getObjectByName('VH_F_ascending_aorta');
  const rootPoint = aorta
    ? new THREE.Box3().setFromObject(aorta).getCenter(new THREE.Vector3())
    : new THREE.Vector3(0, 0, 0);
  const anchors: Built['anchors'] = {};
  for (const key of CORONARY_KEYS) {
    const found = farthestVertex(meshes.coronary[key], rootPoint);
    if (found) anchors[key] = found;
  }
  return { root, scale, radius: (maxDim * scale) / 2, anchors, meshes };
}

function farthestVertex(meshes: THREE.Mesh[], from: THREE.Vector3): THREE.Vector3 | undefined {
  const v = new THREE.Vector3();
  let best: THREE.Vector3 | undefined;
  let bestD = -1;
  for (const m of meshes) {
    const pos = m.geometry.attributes.position;
    for (let i = 0; i < pos.count; i += 2) {
      v.fromBufferAttribute(pos, i).applyMatrix4(m.matrixWorld);
      const d = v.distanceToSquared(from);
      if (d > bestD) {
        bestD = d;
        best = v.clone();
      }
    }
  }
  return best;
}

/** DOM label attached to a vertex of the artery it names. Dimmed while that point faces away from the camera. */
function VesselLabel({
  vesselKey,
  anchor,
  scale,
  reading,
  isSelected,
  onToggle,
}: {
  vesselKey: CoronaryKey;
  anchor: THREE.Vector3;
  scale: number;
  reading: VesselReading;
  isSelected: boolean;
  onToggle: () => void;
}) {
  const meta = VESSEL_META[vesselKey];
  const color = BAND_COLOR[reading.band ?? 'none'];
  const ref = useRef<HTMLDivElement>(null);
  const camera = useThree((s) => s.camera);
  const tmpA = useMemo(() => new THREE.Vector3(), []);
  const tmpB = useMemo(() => new THREE.Vector3(), []);
  useFrame(() => {
    if (!ref.current) return;
    tmpA.copy(anchor).multiplyScalar(scale).normalize();
    tmpB.copy(camera.position).normalize();
    ref.current.style.opacity = tmpA.dot(tmpB) > -0.15 ? '1' : '0.38';
  });
  return (
    <Html position={anchor} center zIndexRange={[30, 0]}>
      <div ref={ref}>
        <button
          type="button"
          onClick={onToggle}
          aria-pressed={isSelected}
          aria-label={`${meta.fullName} (${meta.abbreviation}): ${
            reading.probability === undefined ? 'no model estimate available' : `model estimate ${formatPercent(reading.probability)}`
          }`}
          className={`cv-label ${isSelected ? 'cv-label-selected' : ''}`}
          style={{ borderColor: color, color: '#f1f9ff' }}
        >
          <span className="cv-label-dot" style={{ background: color }} aria-hidden="true" />
          <span className="font-bold">{meta.abbreviation}</span>
          <span className="font-mono text-[10px] opacity-90">
            {reading.probability === undefined ? 'n/a' : formatPercent(reading.probability)}
          </span>
        </button>
      </div>
    </Html>
  );
}

function disposeMaterials(m: MaterialSet) {
  m.chambers.dispose();
  m.great.dispose();
  m.veins.dispose();
  m.internal.dispose();
  m.unassigned.dispose();
  CORONARY_KEYS.forEach((k) => m.coronary[k].dispose());
}

function HeartModel({
  readings,
  selected,
  onSelect,
  onRadius,
  onReady,
}: Pick<SceneProps, 'readings' | 'selected' | 'onSelect' | 'onReady'> & { onRadius: (r: number) => void }) {
  const gltf = useGLTF(HEART_ASSET_URL);
  const invalidate = useThree((s) => s.invalidate);
  const materials = useMemo(createMaterials, []);
  const built = useMemo(() => buildModel(gltf.scene, materials), [gltf.scene, materials]);

  useEffect(() => () => disposeMaterials(materials), [materials]);
  useEffect(() => {
    onRadius(built.radius);
    onReady();
  }, [built, onRadius, onReady]);

  // Visual state: availability and band come only from the actual backend values in `readings`.
  useEffect(() => {
    const anySelected = selected !== null;
    for (const key of CORONARY_KEYS) {
      const reading = readings[key];
      const mat = materials.coronary[key];
      const color = new THREE.Color(BAND_COLOR[reading.band ?? 'none']);
      const isSel = selected === key;
      mat.color.copy(color);
      mat.emissive.copy(color);
      mat.emissiveIntensity = isSel ? 1.5 : anySelected ? 0.22 : reading.band ? 0.7 : 0.35;
      mat.opacity = 1;
    }
    materials.unassigned.emissiveIntensity = anySelected ? 0.2 : 0.5;
    materials.chambers.uniforms.uBoost.value = selected === 'chambers' ? 0.9 : 0;
    materials.great.uniforms.uBoost.value = selected === 'great_vessels' ? 0.9 : 0;
    invalidate();
  }, [readings, selected, materials, invalidate]);

  const handleClick = (e: ThreeEvent<MouseEvent>) => {
    const key = e.object.userData.structure as StructureKey | undefined;
    if (key) {
      e.stopPropagation();
      onSelect(key);
    }
  };
  const handleOver = (e: ThreeEvent<PointerEvent>) => {
    if (e.object.userData.structure) document.body.style.cursor = 'pointer';
  };
  const handleOut = () => {
    document.body.style.cursor = '';
  };

  return (
    <group scale={built.scale}>
      <primitive object={built.root} onClick={handleClick} onPointerOver={handleOver} onPointerOut={handleOut} />
      {CORONARY_KEYS.map((key) => {
        const anchor = built.anchors[key];
        if (!anchor) return null;
        return (
          <VesselLabel
            key={key}
            vesselKey={key}
            anchor={anchor}
            scale={built.scale}
            reading={readings[key]}
            isSelected={selected === key}
            onToggle={() => onSelect(selected === key ? null : key)}
          />
        );
      })}
    </group>
  );
}

const VIEW_DIRS: Record<string, THREE.Vector3> = {
  reset: DEFAULT_DIR,
  front: new THREE.Vector3(0, 0.06, 1).normalize(),
  back: new THREE.Vector3(0, 0.06, -1).normalize(),
  // The model uses patient coordinates: +x is the patient's left, +z is anterior.
  left: new THREE.Vector3(1, 0.06, 0.12).normalize(),
  right: new THREE.Vector3(-1, 0.06, 0.12).normalize(),
  top: new THREE.Vector3(0, 1, 0.08).normalize(),
};

function CameraRig({ command, radius }: { command: ViewCommand | null; radius: number }) {
  const camera = useThree((s) => s.camera);
  const controls = useThree((s) => s.controls) as OrbitControlsImpl | null;
  const invalidate = useThree((s) => s.invalidate);
  const anim = useRef<{ fromDir: THREE.Vector3; toDir: THREE.Vector3; fromDist: number; toDist: number; t: number } | null>(null);
  const baseDist = (radius * 1.15) / Math.tan((FOV * Math.PI) / 360) + radius * 0.25;
  const minDist = radius * 0.55;
  const maxDist = radius * 7;

  // Frame the model whenever its size becomes known.
  useEffect(() => {
    camera.position.copy(DEFAULT_DIR).multiplyScalar(baseDist);
    camera.lookAt(0, 0, 0);
    controls?.target.set(0, 0, 0);
    controls?.update();
    invalidate();
  }, [baseDist, camera, controls, invalidate]);

  useEffect(() => {
    if (!command || !controls) return;
    const offset = camera.position.clone().sub(controls.target);
    const dist = offset.length();
    const dir = offset.clone().normalize();
    let toDir = dir.clone();
    let toDist = dist;
    const up = new THREE.Vector3(0, 1, 0);
    switch (command.type) {
      case 'zoomIn':
        toDist = Math.max(minDist, dist * 0.78);
        break;
      case 'zoomOut':
        toDist = Math.min(maxDist, dist * 1.28);
        break;
      case 'rotL':
        toDir.applyAxisAngle(up, -0.35);
        break;
      case 'rotR':
        toDir.applyAxisAngle(up, 0.35);
        break;
      case 'rotU':
        toDir.applyAxisAngle(new THREE.Vector3().crossVectors(up, dir).normalize(), -0.25);
        break;
      case 'rotD':
        toDir.applyAxisAngle(new THREE.Vector3().crossVectors(up, dir).normalize(), 0.25);
        break;
      case 'reset':
        controls.target.set(0, 0, 0);
        toDir = DEFAULT_DIR.clone();
        toDist = baseDist;
        break;
      default:
        toDir = VIEW_DIRS[command.type].clone();
        toDist = Math.min(dist, baseDist * 1.05);
    }
    const reduce = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (reduce) {
      camera.position.copy(controls.target).add(toDir.normalize().multiplyScalar(toDist));
      controls.update();
      invalidate();
      anim.current = null;
    } else {
      anim.current = { fromDir: dir, toDir: toDir.normalize(), fromDist: dist, toDist, t: 0 };
      invalidate();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [command]);

  useFrame((_, delta) => {
    const a = anim.current;
    if (!a || !controls) return;
    a.t = Math.min(1, a.t + delta / 0.6);
    const e = 1 - Math.pow(1 - a.t, 3);
    const dir = a.fromDir.clone().lerp(a.toDir, e).normalize();
    const dist = a.fromDist + (a.toDist - a.fromDist) * e;
    camera.position.copy(controls.target).add(dir.multiplyScalar(dist));
    controls.update();
    if (a.t >= 1) anim.current = null;
    else invalidate();
  });

  return (
    <OrbitControls
      makeDefault
      enableDamping
      dampingFactor={0.09}
      rotateSpeed={0.7}
      zoomSpeed={0.8}
      minDistance={minDist}
      maxDistance={maxDist}
      enablePan
      screenSpacePanning
    />
  );
}

export default function HeartScene({ readings, selected, onSelect, command, onFailure, onReady }: SceneProps) {
  const [radius, setRadius] = useState(TARGET_SIZE / 2);

  return (
    <Canvas
      frameloop="demand"
      dpr={[1, 1.75]}
      camera={{ fov: FOV, near: 0.05, far: 100, position: [0.5, 0.4, 8] }}
      gl={{ antialias: true, alpha: true, powerPreference: 'default' }}
      onCreated={({ gl }) => {
        gl.setClearColor(0x000000, 0);
        gl.domElement.addEventListener('webglcontextlost', (ev) => {
          ev.preventDefault();
          onFailure('WebGL context lost');
        });
      }}
    >
      <ambientLight intensity={0.9} />
      <directionalLight position={[-3, 4, 5]} intensity={2.0} color="#dff6ff" />
      <directionalLight position={[4, -2, -4]} intensity={1.1} color="#2f9bff" />
      <HeartModel readings={readings} selected={selected} onSelect={onSelect} onRadius={setRadius} onReady={onReady} />
      <CameraRig command={command} radius={radius} />
    </Canvas>
  );
}
