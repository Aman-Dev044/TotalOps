import * as THREE from 'three';
import type { TintZone } from './tint';

/**
 * Parametric body definitions (metres). +x = front of the car, y = up, +z = right-hand (driver side in AU).
 * xA/xB/xC/xD trace the greenhouse: windscreen base, roof front, roof rear, rear-glass base.
 * `pillars` are the vertical B/C pillars between the A-line and the D-line (front → rear).
 */
export type BodyDef = {
  L: number; W: number; wb: number; frontOverhang: number; R: number; wheelW: number; clear: number;
  noseY: number; hoodY: number; beltY: number; roofY: number; deckY: number;
  xA: number; xB: number; xC: number; xD: number; pillars: number[];
  tray?: { floorY: number };
};

export const BODIES: Record<string, BodyDef> = {
  sedan: { L: 4.75, W: 1.85, wb: 2.85, frontOverhang: 0.95, R: 0.335, wheelW: 0.24, clear: 0.17, noseY: 0.66, hoodY: 0.9, beltY: 0.97, roofY: 1.44, deckY: 0.99, xA: 0.78, xB: 0.05, xC: -0.95, xD: -1.55, pillars: [-0.35] },
  hatch: { L: 4.3, W: 1.8, wb: 2.65, frontOverhang: 0.85, R: 0.32, wheelW: 0.23, clear: 0.16, noseY: 0.66, hoodY: 0.9, beltY: 0.97, roofY: 1.46, deckY: 1.0, xA: 0.72, xB: 0.0, xC: -1.45, xD: -1.95, pillars: [-0.42, -1.25] },
  suv: { L: 4.75, W: 1.92, wb: 2.85, frontOverhang: 0.9, R: 0.38, wheelW: 0.26, clear: 0.24, noseY: 0.86, hoodY: 1.08, beltY: 1.15, roofY: 1.7, deckY: 1.15, xA: 0.92, xB: 0.2, xC: -1.85, xD: -2.15, pillars: [-0.32, -1.35] },
  wagon: { L: 4.85, W: 1.86, wb: 2.8, frontOverhang: 0.95, R: 0.34, wheelW: 0.24, clear: 0.2, noseY: 0.7, hoodY: 0.93, beltY: 1.0, roofY: 1.52, deckY: 1.0, xA: 0.85, xB: 0.12, xC: -1.95, xD: -2.25, pillars: [-0.35, -1.4] },
  ute: { L: 5.3, W: 1.9, wb: 3.1, frontOverhang: 0.9, R: 0.39, wheelW: 0.27, clear: 0.28, noseY: 0.98, hoodY: 1.16, beltY: 1.22, roofY: 1.82, deckY: 1.22, xA: 1.12, xB: 0.45, xC: -0.95, xD: -1.0, pillars: [-0.15], tray: { floorY: 0.95 } },
  single_cab: { L: 5.3, W: 1.9, wb: 3.1, frontOverhang: 0.9, R: 0.39, wheelW: 0.27, clear: 0.28, noseY: 0.98, hoodY: 1.16, beltY: 1.22, roofY: 1.82, deckY: 1.22, xA: 1.12, xB: 0.45, xC: -0.35, xD: -0.4, pillars: [], tray: { floorY: 0.95 } },
  coupe: { L: 4.65, W: 1.86, wb: 2.75, frontOverhang: 0.95, R: 0.34, wheelW: 0.25, clear: 0.14, noseY: 0.62, hoodY: 0.84, beltY: 0.92, roofY: 1.32, deckY: 0.95, xA: 0.6, xB: -0.2, xC: -0.9, xD: -1.65, pillars: [-0.55] },
  van: { L: 5.1, W: 1.95, wb: 3.2, frontOverhang: 0.75, R: 0.36, wheelW: 0.25, clear: 0.2, noseY: 0.9, hoodY: 1.12, beltY: 1.18, roofY: 1.98, deckY: 1.18, xA: 1.55, xB: 0.95, xC: -2.35, xD: -2.5, pillars: [0.35, -0.75] },
};

export const getBodyDef = (key: string) => BODIES[key] || BODIES.suv;

export const TILT = 0.12; // side-glass tumblehome (radians)
export const sideZ = (b: BodyDef) => (b.W / 2) * 0.93;
export const roofZ = (b: BodyDef) => sideZ(b) - (b.roofY - b.beltY) * Math.sin(TILT);

export function wheelXs(b: BodyDef) {
  const front = b.L / 2 - b.frontOverhang;
  return [front, front - b.wb];
}

/** Side profile of the lower body with wheel-arch cut-outs. */
export function bodyShape(b: BodyDef) {
  const Xf = b.L / 2;
  const Xr = -b.L / 2;
  const Ra = b.R + 0.1;
  const s = Math.max(-0.99, Math.min(0.99, (b.clear - b.R) / Ra));
  const t1 = Math.asin(s);
  const t2 = Math.PI - t1;
  const [fw, rw] = wheelXs(b);
  const sh = new THREE.Shape();
  sh.moveTo(Xr + 0.1, b.clear);
  sh.absarc(rw, b.R, Ra, t2, t1, true);
  sh.absarc(fw, b.R, Ra, t2, t1, true);
  sh.lineTo(Xf - 0.1, b.clear);
  sh.lineTo(Xf, b.clear + 0.14);
  sh.lineTo(Xf + 0.02, b.noseY - 0.08);
  sh.quadraticCurveTo(Xf, b.noseY, Xf - 0.16, b.noseY + 0.01);
  sh.quadraticCurveTo((Xf + b.xA) / 2, b.hoodY - 0.01, b.xA + 0.05, b.hoodY);
  sh.lineTo(b.xA, b.beltY);
  if (b.tray) {
    sh.lineTo(b.xD, b.beltY);
    sh.lineTo(b.xD - 0.02, b.tray.floorY);
    sh.lineTo(Xr + 0.04, b.tray.floorY);
    sh.lineTo(Xr, b.tray.floorY - 0.08);
  } else {
    sh.lineTo(b.xD, b.beltY);
    sh.quadraticCurveTo(Xr + 0.25, b.deckY + 0.01, Xr + 0.06, b.deckY - 0.03);
    sh.lineTo(Xr, b.deckY - 0.14);
  }
  sh.lineTo(Xr - 0.02, b.clear + 0.14);
  sh.lineTo(Xr + 0.1, b.clear);
  return sh;
}

export type WindowSeg = { zone: TintZone; pts: [number, number][]; label: string };

/** Window polygons in the side-frame's local space (origin at x=0, y=beltY). */
export function windowSegments(b: BodyDef): WindowSeg[] {
  const h = b.roofY - b.beltY;
  const yb = 0.035;
  const yt = h - 0.055;
  const p = 0.07;
  const pp = 0.045;
  const fA = (y: number) => b.xA + (b.xB - b.xA) * (y / h) - p;
  const fD = (y: number) => b.xD + (b.xC - b.xD) * (y / h) + p;
  const edges: { front: (y: number) => number; rear: (y: number) => number }[] = [];
  const bounds = [...b.pillars];
  let front = fA;
  for (const px of bounds) {
    const fr = front;
    edges.push({ front: fr, rear: () => px + pp });
    front = () => px - pp;
  }
  edges.push({ front, rear: fD });
  return edges.map((e, i) => ({
    zone: i === 0 ? 'frontSides' : 'rearSides',
    label: i === 0 ? 'Front' : i === edges.length - 1 && edges.length > 2 ? 'Quarter' : 'Rear',
    pts: [
      [e.rear(yb), yb],
      [e.front(yb), yb],
      [e.front(yt), yt],
      [e.rear(yt), yt],
    ],
  }));
}

export function frameShape(b: BodyDef, segs: WindowSeg[]) {
  const h = b.roofY - b.beltY;
  const sh = new THREE.Shape();
  sh.moveTo(b.xD, 0);
  sh.lineTo(b.xA, 0);
  sh.lineTo(b.xB, h);
  sh.lineTo(b.xC, h);
  sh.lineTo(b.xD, 0);
  for (const s of segs) {
    const hole = new THREE.Path();
    hole.moveTo(s.pts[0][0], s.pts[0][1]);
    for (const pt of s.pts.slice(1)) hole.lineTo(pt[0], pt[1]);
    hole.closePath();
    sh.holes.push(hole);
  }
  return sh;
}

export function polyShape(pts: [number, number][]) {
  const sh = new THREE.Shape();
  sh.moveTo(pts[0][0], pts[0][1]);
  for (const p of pts.slice(1)) sh.lineTo(p[0], p[1]);
  sh.closePath();
  return sh;
}

/** A flat quad from four 3D corners (two triangles, double-sided material expected). */
export function quad(a: number[], b: number[], c: number[], d: number[]) {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute([...a, ...b, ...c, ...a, ...c, ...d], 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute([0, 0, 1, 0, 1, 1, 0, 0, 1, 1, 0, 1], 2));
  g.computeVertexNormals();
  return g;
}

export const lerp3 = (a: number[], b: number[], t: number) => a.map((v, i) => v + (b[i] - v) * t);
