'use client';

import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { RoundedBox } from '@react-three/drei';
import { BODIES, TILT, bodyShape, frameShape, getBodyDef, lerp3, polyShape, quad, roofZ, sideZ, wheelXs, windowSegments, type BodyDef } from './car-geometry';
import { WHEEL_COLORS, combinedVlt, glassLook, type CarConfig, type EnvKey, type TintZone } from './tint';
import type { Film, LegalRule } from '@/lib/types';

const FINISH = {
  gloss: { metalness: 0.15, roughness: 0.22, clearcoat: 1, clearcoatRoughness: 0.05, sheen: 0, iridescence: 0 },
  metallic: { metalness: 0.65, roughness: 0.3, clearcoat: 1, clearcoatRoughness: 0.06, sheen: 0, iridescence: 0 },
  pearl: { metalness: 0.35, roughness: 0.25, clearcoat: 1, clearcoatRoughness: 0.04, sheen: 0.6, iridescence: 0.25 },
  matte: { metalness: 0.1, roughness: 0.72, clearcoat: 0, clearcoatRoughness: 0.5, sheen: 0, iridescence: 0 },
};

function useDispose(...items: { dispose: () => void }[]) {
  useEffect(() => () => items.forEach((i) => i.dispose()), items); // eslint-disable-line react-hooks/exhaustive-deps
}

/** Smoothly animated tinted glass. */
function GlassMesh({ geometry, zone, look, position, rotation }: { geometry: THREE.BufferGeometry; zone: string; look: ReturnType<typeof glassLook>; position?: [number, number, number]; rotation?: [number, number, number] }) {
  const mat = useMemo(
    () => new THREE.MeshPhysicalMaterial({ transparent: true, side: THREE.DoubleSide, depthWrite: false, envMapIntensity: 1.6, clearcoat: 1, clearcoatRoughness: 0.02, color: look.color, opacity: look.opacity, roughness: look.roughness, metalness: look.metalness }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );
  useDispose(mat);
  const target = useRef({ color: new THREE.Color(look.color), opacity: look.opacity, metalness: look.metalness });
  useEffect(() => {
    target.current.color.set(look.color);
    target.current.opacity = look.opacity;
    target.current.metalness = look.metalness;
  }, [look.color, look.opacity, look.metalness]);
  useFrame((_, dt) => {
    const k = Math.min(1, dt * 6);
    mat.color.lerp(target.current.color, k);
    mat.opacity += (target.current.opacity - mat.opacity) * k;
    mat.metalness += (target.current.metalness - mat.metalness) * k;
  });
  return <mesh geometry={geometry} material={mat} position={position} rotation={rotation} name={`glass-${zone}`} renderOrder={2} />;
}

type Props = { cfg: CarConfig; films: Film[]; rule?: LegalRule; env: EnvKey };

export function CarModel({ cfg, films, rule, env }: Props) {
  const b: BodyDef = getBodyDef(cfg.bodyType);
  const h = b.roofY - b.beltY;
  const zs = sideZ(b);
  const zr = roofZ(b);
  const filmOf = (id: string | null) => films.find((f) => f._id === id) || null;

  /* ---------- materials ---------- */
  const paint = useMemo(() => new THREE.MeshPhysicalMaterial({ color: cfg.paint, envMapIntensity: 1.3 }), []); // eslint-disable-line react-hooks/exhaustive-deps
  const trim = useMemo(() => new THREE.MeshPhysicalMaterial({ color: '#0d0e10', roughness: 0.35, metalness: 0.2, clearcoat: 0.6 }), []);
  const chrome = useMemo(() => new THREE.MeshStandardMaterial({ color: '#e6eaee', roughness: 0.08, metalness: 1, envMapIntensity: 1.6 }), []);
  const rubber = useMemo(() => new THREE.MeshStandardMaterial({ color: '#141414', roughness: 0.92, metalness: 0 }), []);
  const rimMat = useMemo(() => new THREE.MeshStandardMaterial({ color: '#555', roughness: 0.3, metalness: 0.85, envMapIntensity: 1.4 }), []);
  const interior = useMemo(() => new THREE.MeshStandardMaterial({ color: '#cfc8bb', roughness: 0.85 }), []);
  const interiorDark = useMemo(() => new THREE.MeshStandardMaterial({ color: '#2a2a2d', roughness: 0.8 }), []);
  const head = useMemo(() => new THREE.MeshStandardMaterial({ color: '#f7fbff', emissive: '#e8f2ff', emissiveIntensity: 1, roughness: 0.1 }), []);
  const tail = useMemo(() => new THREE.MeshStandardMaterial({ color: '#7a0a10', emissive: '#ff1f2e', emissiveIntensity: 0.7, roughness: 0.2 }), []);
  useDispose(paint, trim, chrome, rubber, rimMat, interior, interiorDark, head, tail);

  const paintTarget = useRef(new THREE.Color(cfg.paint));
  useEffect(() => {
    paintTarget.current.set(cfg.paint);
    const f = FINISH[cfg.finish] || FINISH.gloss;
    Object.assign(paint, { metalness: f.metalness, roughness: f.roughness, clearcoat: f.clearcoat, clearcoatRoughness: f.clearcoatRoughness, sheen: f.sheen, iridescence: f.iridescence });
    paint.sheenColor = new THREE.Color('#ffffff');
    paint.needsUpdate = true;
  }, [cfg.paint, cfg.finish, paint]);
  useEffect(() => {
    const w = WHEEL_COLORS[cfg.wheelColor] || WHEEL_COLORS.silver;
    rimMat.color.set(w.hex);
    rimMat.metalness = w.metal;
    rimMat.roughness = w.rough;
  }, [cfg.wheelColor, rimMat]);
  useEffect(() => {
    const night = env === 'night';
    head.emissiveIntensity = night ? 3.2 : 0.9;
    tail.emissiveIntensity = night ? 2.2 : 0.6;
  }, [env, head, tail]);
  useFrame((_, dt) => paint.color.lerp(paintTarget.current, Math.min(1, dt * 5)));

  const trimMat = cfg.chromeDelete ? trim : chrome;
  const roofMat = cfg.roof === 'black' ? trim : paint;

  /* ---------- geometry (rebuilt per body type) ---------- */
  const geo = useMemo(() => {
    const bodyGeo = new THREE.ExtrudeGeometry(bodyShape(b), { depth: b.W - 0.12, bevelEnabled: true, bevelThickness: 0.06, bevelSize: 0.05, bevelSegments: 5, curveSegments: 28 });
    bodyGeo.translate(0, 0, -(b.W - 0.12) / 2);
    const segs = windowSegments(b);
    const frameGeo = new THREE.ExtrudeGeometry(frameShape(b, segs), { depth: 0.035, bevelEnabled: false });
    const winGeos = segs.map((s) => ({ zone: s.zone, label: s.label, geo: new THREE.ShapeGeometry(polyShape(s.pts)) }));
    // Windscreen & rear glass quads (slight inset so pillars frame them)
    const A_l = [b.xA, b.beltY + 0.01, -zs + 0.03], A_r = [b.xA, b.beltY + 0.01, zs - 0.03];
    const B_l = [b.xB, b.roofY - 0.01, -zr + 0.03], B_r = [b.xB, b.roofY - 0.01, zr - 0.03];
    const C_l = [b.xC, b.roofY - 0.01, -zr + 0.03], C_r = [b.xC, b.roofY - 0.01, zr - 0.03];
    const D_l = [b.xD, b.beltY + 0.01, -zs + 0.03], D_r = [b.xD, b.beltY + 0.01, zs - 0.03];
    const windscreen = quad(A_l, A_r, B_r, B_l);
    const rearScreen = quad(D_r, D_l, C_l, C_r);
    const stripPct = Math.max(0.06, Math.min(0.25, (rule?.windscreenStripPct ?? 10) / 100));
    const visor = quad(lerp3(A_l, B_l, 1 - stripPct), lerp3(A_r, B_r, 1 - stripPct), B_r, B_l);
    // Pillar caps between windscreen/rear glass and side frames
    const pillarL = quad([b.xA, b.beltY, -zs], [b.xA, b.beltY, -zs + 0.05], [b.xB, b.roofY, -zr + 0.05], [b.xB, b.roofY, -zr]);
    const pillarR = quad([b.xA, b.beltY, zs - 0.05], [b.xA, b.beltY, zs], [b.xB, b.roofY, zr], [b.xB, b.roofY, zr - 0.05]);
    const cpL = quad([b.xD, b.beltY, -zs], [b.xD, b.beltY, -zs + 0.05], [b.xC, b.roofY, -zr + 0.05], [b.xC, b.roofY, -zr]);
    const cpR = quad([b.xD, b.beltY, zs - 0.05], [b.xD, b.beltY, zs], [b.xC, b.roofY, zr], [b.xC, b.roofY, zr - 0.05]);
    const tyre = new THREE.CylinderGeometry(b.R, b.R, b.wheelW, 44, 1);
    tyre.rotateX(Math.PI / 2);
    return { bodyGeo, frameGeo, winGeos, windscreen, rearScreen, visor, pillarL, pillarR, cpL, cpR, tyre };
  }, [cfg.bodyType, rule?.windscreenStripPct]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(
    () => () => {
      geo.bodyGeo.dispose();
      geo.frameGeo.dispose();
      geo.winGeos.forEach((w) => w.geo.dispose());
      [geo.windscreen, geo.rearScreen, geo.visor, geo.pillarL, geo.pillarR, geo.cpL, geo.cpR, geo.tyre].forEach((g) => g.dispose());
    },
    [geo],
  );

  /* ---------- tint looks ---------- */
  const lookFor = (zone: TintZone) => {
    const t = cfg.zones[zone];
    return glassLook(combinedVlt(zone, t.vlt, cfg.privacyRear), filmOf(t.filmId));
  };
  const looks = { frontSides: lookFor('frontSides'), rearSides: lookFor('rearSides'), rearWindscreen: lookFor('rearWindscreen'), sunroof: lookFor('sunroof') };
  const windscreenLook = glassLook(combinedVlt('windscreen', null), null);
  const visorFilm = filmOf(cfg.visor.filmId) || filmOf(cfg.zones.frontSides.filmId);
  const visorLook = glassLook(cfg.visor.vlt ?? 15, visorFilm);

  const [fw, rw] = wheelXs(b);
  const rimR = b.R * (cfg.wheelSize === 21 ? 0.78 : cfg.wheelSize === 19 ? 0.7 : 0.62);
  const Xf = b.L / 2;
  const Xr = -b.L / 2;
  const seatX = (b.pillars[0] ?? b.xC) + 0.32;
  const rearSeatX = b.pillars.length ? (b.pillars[0] + (b.pillars[1] ?? b.xC)) / 2 - 0.05 : null;

  return (
    <group>
      {/* Lower body */}
      <mesh geometry={geo.bodyGeo} material={paint} castShadow receiveShadow />

      {/* Side frames (pillars) with tinted side glass */}
      {[1, -1].map((side) => (
        <group key={side} position={[0, b.beltY, side * zs]} rotation={[-side * TILT, 0, 0]}>
          <mesh geometry={geo.frameGeo} material={roofMat} position={[0, 0, side > 0 ? -0.035 : 0]} castShadow />
          {geo.winGeos.map((w, i) => (
            <GlassMesh key={`${side}-${i}`} geometry={w.geo} zone={w.zone} look={looks[w.zone]} position={[0, 0, side * 0.004]} />
          ))}
          {/* belt-line trim */}
          <mesh position={[(b.xA + b.xD) / 2, 0.012, side * 0.01]} material={trimMat}>
            <boxGeometry args={[Math.abs(b.xA - b.xD) - 0.06, 0.018, 0.012]} />
          </mesh>
        </group>
      ))}

      {/* Roof */}
      <RoundedBox args={[b.xB - b.xC + 0.08, 0.07, zr * 2 + 0.06]} radius={0.03} smoothness={3} position={[(b.xB + b.xC) / 2, b.roofY, 0]} material={roofMat} castShadow />
      {cfg.sunroof ? (
        <GlassMesh geometry={sunroofGeometry(b, zr)} zone="sunroof" look={looks.sunroof} position={[0, 0, 0]} />
      ) : null}

      {/* Windscreen, visor strip, rear glass, pillar caps */}
      <GlassMesh geometry={geo.windscreen} zone="windscreen" look={windscreenLook} />
      {cfg.visor.enabled ? <GlassMesh geometry={geo.visor} zone="visor" look={visorLook} position={[0.004, 0.003, 0]} /> : null}
      <GlassMesh geometry={geo.rearScreen} zone="rearWindscreen" look={looks.rearWindscreen} />
      {[geo.pillarL, geo.pillarR, geo.cpL, geo.cpR].map((g, i) => (
        <mesh key={i} geometry={g} material={roofMat} />
      ))}

      {/* Interior — so tint darkness reads correctly */}
      <mesh position={[(b.xA + b.xD) / 2, b.beltY + 0.012, 0]} material={interiorDark}>
        <boxGeometry args={[Math.abs(b.xA - b.xD) - 0.1, 0.03, zs * 2 - 0.1]} />
      </mesh>
      <mesh position={[b.xA - 0.22, b.beltY + 0.05, 0]} material={interiorDark}>
        <boxGeometry args={[0.36, 0.16, zs * 2 - 0.16]} />
      </mesh>
      <mesh position={[b.xA - 0.48, b.beltY + 0.13, 0.38]} rotation={[0, Math.PI / 2, 0.35]} material={interiorDark}>
        <torusGeometry args={[0.17, 0.022, 10, 32]} />
      </mesh>
      {[0.38, -0.38].map((z) => (
        <group key={z} position={[seatX, b.beltY - 0.18, z]}>
          <mesh material={interior} position={[0, 0, 0]}>
            <boxGeometry args={[0.48, 0.12, 0.46]} />
          </mesh>
          <mesh material={interior} position={[-0.26, 0.32, 0]} rotation={[0, 0, 0.18]}>
            <boxGeometry args={[0.1, 0.62, 0.44]} />
          </mesh>
          <mesh material={interior} position={[-0.32, 0.7, 0]}>
            <boxGeometry args={[0.09, 0.16, 0.26]} />
          </mesh>
        </group>
      ))}
      {rearSeatX !== null ? (
        <group position={[rearSeatX, b.beltY - 0.16, 0]}>
          <mesh material={interior}>
            <boxGeometry args={[0.46, 0.12, zs * 2 - 0.35]} />
          </mesh>
          <mesh material={interior} position={[-0.25, 0.3, 0]} rotation={[0, 0, 0.16]}>
            <boxGeometry args={[0.1, 0.58, zs * 2 - 0.35]} />
          </mesh>
        </group>
      ) : null}

      {/* Lights, grille, mirrors */}
      {[1, -1].map((side) => (
        <group key={`l${side}`}>
          <RoundedBox args={[0.08, 0.09, 0.4]} radius={0.02} position={[Xf - 0.05, b.noseY - 0.07, side * (b.W / 2 - 0.3)]} material={head} />
          <RoundedBox args={[0.07, 0.09, 0.42]} radius={0.02} position={[Xr + 0.03, (b.tray ? b.tray.floorY : b.deckY) - 0.14, side * (b.W / 2 - 0.3)]} material={tail} />
          <RoundedBox args={[0.2, 0.11, 0.13]} radius={0.03} position={[b.xA - 0.14, b.beltY + 0.07, side * (zs + 0.12)]} material={cfg.chromeDelete ? trim : paint} />
        </group>
      ))}
      <RoundedBox args={[0.06, 0.2, b.W * 0.46]} radius={0.02} position={[Xf - 0.02, b.noseY - 0.24, 0]} material={trim} />
      <mesh position={[Xf, b.noseY - 0.13, 0]} material={trimMat}>
        <boxGeometry args={[0.03, 0.025, b.W * 0.48]} />
      </mesh>

      {/* Ute tray */}
      {b.tray ? (
        <group>
          {[1, -1].map((side) => (
            <mesh key={side} position={[(b.xD - 0.06 + Xr) / 2, (b.tray!.floorY + b.beltY) / 2, side * (b.W / 2 - 0.045)]} material={paint} castShadow>
              <boxGeometry args={[Math.abs(b.xD - 0.06 - Xr), b.beltY - b.tray!.floorY, 0.05]} />
            </mesh>
          ))}
          <mesh position={[Xr + 0.03, (b.tray.floorY + b.beltY) / 2, 0]} material={paint} castShadow>
            <boxGeometry args={[0.05, b.beltY - b.tray.floorY, b.W - 0.1]} />
          </mesh>
          <mesh position={[b.xD - 0.06, (b.tray.floorY + b.beltY) / 2 + 0.02, 0]} material={paint}>
            <boxGeometry args={[0.05, b.beltY - b.tray.floorY + 0.04, b.W - 0.1]} />
          </mesh>
          <mesh position={[(b.xD + Xr) / 2, b.tray.floorY + 0.005, 0]} material={interiorDark}>
            <boxGeometry args={[Math.abs(b.xD - Xr) - 0.12, 0.01, b.W - 0.18]} />
          </mesh>
        </group>
      ) : null}

      {/* Wheels */}
      {[fw, rw].flatMap((x) =>
        [1, -1].map((side) => (
          <group key={`${x}${side}`} position={[x, b.R, side * (b.W / 2 - b.wheelW / 2 - 0.02)]}>
            <mesh geometry={geo.tyre} material={rubber} castShadow />
            <group position={[0, 0, side * (b.wheelW / 2 + 0.002)]}>
              <mesh material={rimMat} rotation={[Math.PI / 2, 0, 0]}>
                <cylinderGeometry args={[rimR, rimR, 0.03, 40]} />
              </mesh>
              <mesh material={trim} rotation={[Math.PI / 2, 0, 0]} position={[0, 0, side * 0.006]}>
                <cylinderGeometry args={[rimR * 0.82, rimR * 0.82, 0.03, 40]} />
              </mesh>
              {Array.from({ length: 5 }).map((_, i) => (
                <mesh key={i} material={rimMat} rotation={[0, 0, (i * Math.PI) / 5]} position={[0, 0, side * 0.018]}>
                  <boxGeometry args={[0.055, rimR * 1.62, 0.025]} />
                </mesh>
              ))}
              <mesh material={rimMat} rotation={[Math.PI / 2, 0, 0]} position={[0, 0, side * 0.025]}>
                <cylinderGeometry args={[rimR * 0.2, rimR * 0.2, 0.03, 24]} />
              </mesh>
            </group>
          </group>
        )),
      )}
    </group>
  );
}

// Sunroof panel geometry (memoised per body & roof width).
const sunroofCache = new Map<string, THREE.BufferGeometry>();
function sunroofGeometry(b: BodyDef, zr: number) {
  const key = `${b.xB}|${b.xC}|${zr}|${b.roofY}`;
  let g = sunroofCache.get(key);
  if (!g) {
    const len = Math.min(0.95, (b.xB - b.xC) * 0.42);
    const cx = b.xB - 0.15 - len / 2;
    const y = b.roofY + 0.037;
    const hw = zr * 0.62;
    g = quad([cx - len / 2, y, -hw], [cx + len / 2, y, -hw], [cx + len / 2, y, hw], [cx - len / 2, y, hw]);
    sunroofCache.set(key, g);
  }
  return g;
}

export const BODY_KEYS = Object.keys(BODIES);
