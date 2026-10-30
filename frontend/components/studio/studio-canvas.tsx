'use client';

import { Suspense, useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { ContactShadows, Environment, Lightformer, OrbitControls, useGLTF } from '@react-three/drei';
import { CarModel } from './car-model';
import { getBodyDef } from './car-geometry';
import type { CameraKey, CarConfig, EnvKey } from './tint';
import type { Film, LegalRule } from '@/lib/types';

const ENVS: Record<EnvKey, { bg: string; floor: string; ambient: number; sun: number; sunColor: string; sunPos: [number, number, number]; envIntensity: number }> = {
  day: { bg: '#dde6ef', floor: '#cfd7e0', ambient: 0.55, sun: 2.4, sunColor: '#ffffff', sunPos: [6, 9, 5], envIntensity: 1 },
  sunset: { bg: '#e7ae86', floor: '#a9877a', ambient: 0.35, sun: 2.2, sunColor: '#ffa45c', sunPos: [-7, 2.6, 4], envIntensity: 0.8 },
  night: { bg: '#080c18', floor: '#141a28', ambient: 0.12, sun: 0.35, sunColor: '#8fb1ff', sunPos: [4, 8, -3], envIntensity: 0.35 },
  studio: { bg: '#1c1e23', floor: '#26292f', ambient: 0.3, sun: 1.4, sunColor: '#ffffff', sunPos: [3, 8, 6], envIntensity: 1.2 },
};

type Goal = { pos: THREE.Vector3; target: THREE.Vector3 } | null;

function presetFor(key: CameraKey, bodyType: string): { pos: [number, number, number]; target: [number, number, number] } {
  const b = getBodyDef(bodyType);
  const L = b.L;
  switch (key) {
    case 'side':
      return { pos: [0.2, 1.15, L * 1.38], target: [0, 0.8, 0] };
    case 'rear':
      return { pos: [-L * 1.05, 1.8, -L * 0.62], target: [0, 0.8, 0] };
    case 'top':
      return { pos: [0.01, L * 1.75, 0.01], target: [0, 0.4, 0] };
    case 'inside': {
      const sx = (b.pillars[0] ?? b.xC) + 0.3;
      const eye: [number, number, number] = [sx, b.beltY + 0.3, 0.38];
      return { pos: eye, target: [eye[0] + 0.06, eye[1] - 0.004, eye[2] - 0.012] };
    }
    default:
      return { pos: [L * 0.98, 1.65, L * 0.95], target: [0, 0.75, 0] };
  }
}

function CameraRig({ goal, controls }: { goal: React.MutableRefObject<Goal>; controls: React.MutableRefObject<any> }) {
  const { camera } = useThree();
  useFrame((_, dt) => {
    const g = goal.current;
    const c = controls.current;
    if (!g || !c) return;
    const k = 1 - Math.pow(0.0025, dt);
    camera.position.lerp(g.pos, k);
    c.target.lerp(g.target, k);
    c.update();
    if (camera.position.distanceTo(g.pos) < 0.01 && c.target.distanceTo(g.target) < 0.01) goal.current = null;
  });
  return null;
}

function ScannedModel({ url }: { url: string }) {
  const gltf = useGLTF(url, false);
  const scene = useMemo(() => {
    const s = gltf.scene.clone(true);
    const box = new THREE.Box3().setFromObject(s);
    const size = box.getSize(new THREE.Vector3());
    const scale = 4.6 / Math.max(size.x, size.z, 0.001);
    s.scale.setScalar(scale);
    const box2 = new THREE.Box3().setFromObject(s);
    const center = box2.getCenter(new THREE.Vector3());
    s.position.set(-center.x, -box2.min.y, -center.z);
    s.traverse((o: any) => {
      if (o.isMesh) o.castShadow = true;
    });
    return s;
  }, [gltf]);
  return <primitive object={scene} />;
}

export type StudioCanvasProps = {
  cfg: CarConfig;
  films: Film[];
  rule?: LegalRule;
  env: EnvKey;
  camera: CameraKey;
  cameraNonce: number;
  autoRotate: boolean;
  scannedUrl?: string | null;
  onGl?: (gl: THREE.WebGLRenderer) => void;
};

export default function StudioCanvas({ cfg, films, rule, env, camera, cameraNonce, autoRotate, scannedUrl, onGl }: StudioCanvasProps) {
  const E = ENVS[env];
  const goal = useRef<Goal>(null);
  const controls = useRef<any>(null);
  const inside = camera === 'inside' && !scannedUrl;

  useEffect(() => {
    const p = presetFor(scannedUrl ? (camera === 'inside' ? 'front' : camera) : camera, cfg.bodyType);
    goal.current = { pos: new THREE.Vector3(...p.pos), target: new THREE.Vector3(...p.target) };
  }, [camera, cameraNonce, cfg.bodyType, scannedUrl]);

  const initial = presetFor('front', cfg.bodyType);

  return (
    <Canvas
      shadows
      dpr={[1, 2]}
      gl={{ preserveDrawingBuffer: true, antialias: true }}
      camera={{ position: initial.pos, fov: 38, near: 0.02, far: 200 }}
      onCreated={({ gl }) => {
        gl.toneMapping = THREE.ACESFilmicToneMapping;
        gl.toneMappingExposure = 1.05;
        onGl?.(gl);
      }}
    >
      <color attach="background" args={[E.bg]} />
      <fog attach="fog" args={[E.bg, 16, 34]} />
      <ambientLight intensity={E.ambient} />
      <directionalLight position={E.sunPos} intensity={E.sun} color={E.sunColor} castShadow shadow-mapSize={[2048, 2048]} shadow-camera-left={-6} shadow-camera-right={6} shadow-camera-top={6} shadow-camera-bottom={-6} />
      {env === 'night' ? (
        <>
          <pointLight position={[3.5, 4.5, 2.5]} intensity={18} distance={14} color="#ffd9a1" />
          <pointLight position={[-4, 3.5, -3]} intensity={10} distance={12} color="#9ec2ff" />
        </>
      ) : null}

      <Environment key={env} resolution={256} frames={1} environmentIntensity={E.envIntensity}>
        <Lightformer form="rect" intensity={env === 'night' ? 0.6 : 2.4} position={[0, 6, -2]} rotation-x={Math.PI / 2} scale={[12, 6, 1]} color={env === 'sunset' ? '#ffd2a8' : '#ffffff'} />
        <Lightformer form="rect" intensity={env === 'night' ? 0.4 : 1.6} position={[-6, 2, 0]} rotation-y={Math.PI / 2} scale={[10, 2, 1]} />
        <Lightformer form="rect" intensity={env === 'night' ? 0.4 : 1.6} position={[6, 2, 0]} rotation-y={-Math.PI / 2} scale={[10, 2, 1]} />
        <Lightformer form="ring" intensity={env === 'studio' ? 3 : 1} position={[0, 3, 8]} scale={4} color={env === 'sunset' ? '#ff9b5c' : '#ffffff'} />
        <Lightformer form="rect" intensity={0.5} position={[0, -1, 0]} rotation-x={-Math.PI / 2} scale={[20, 20, 1]} color={E.floor} />
      </Environment>

      <group>
        {scannedUrl ? (
          <Suspense fallback={null}>
            <ScannedModel url={scannedUrl} />
          </Suspense>
        ) : (
          <CarModel cfg={cfg} films={films} rule={rule} env={env} />
        )}
      </group>

      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.001, 0]} receiveShadow>
        <circleGeometry args={[22, 64]} />
        <meshStandardMaterial color={E.floor} roughness={0.95} />
      </mesh>
      <ContactShadows key={`${cfg.bodyType}-${scannedUrl || ''}`} frames={1} position={[0, 0.002, 0]} scale={12} blur={2.4} far={3} opacity={env === 'night' ? 0.8 : 0.55} resolution={512} />

      <OrbitControls
        ref={controls}
        makeDefault
        enablePan={!inside}
        enableZoom={!inside}
        minDistance={inside ? 0 : 2.5}
        maxDistance={16}
        maxPolarAngle={inside ? Math.PI * 0.75 : Math.PI / 2.05}
        rotateSpeed={inside ? -0.35 : 0.8}
        autoRotate={autoRotate && !inside}
        autoRotateSpeed={0.9}
        enableDamping
        onStart={() => {
          goal.current = null;
        }}
      />
      <CameraRig goal={goal} controls={controls} />
    </Canvas>
  );
}
