/** Client-side photo helpers: resize for upload, dominant body colour via k-means. */

export async function loadImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Could not read that image'));
    img.src = src;
  });
}

/** Resizes to ≤ maxSide px and re-encodes as JPEG. */
export async function resizePhoto(file: File, maxSide = 1600) {
  const url = URL.createObjectURL(file);
  try {
    const img = await loadImage(url);
    const scale = Math.min(1, maxSide / Math.max(img.naturalWidth, img.naturalHeight));
    const w = Math.max(1, Math.round(img.naturalWidth * scale));
    const h = Math.max(1, Math.round(img.naturalHeight * scale));
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas is not available in this browser');
    ctx.drawImage(img, 0, 0, w, h);
    const blob: Blob = await new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Could not encode the photo'))), 'image/jpeg', 0.88));
    return { blob, dataUrl: canvas.toDataURL('image/jpeg', 0.88), width: w, height: h };
  } finally {
    URL.revokeObjectURL(url);
  }
}

const hex = (r: number, g: number, b: number) => '#' + [r, g, b].map((v) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, '0')).join('');
const dist = (a: number[], b: number[]) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

export type ColorAnalysis = { dominant: string; palette: { hex: string; pct: number }[]; aspect: number; orientation: 'landscape' | 'portrait' | 'square' };

export async function analyseColours(dataUrl: string): Promise<ColorAnalysis> {
  const img = await loadImage(dataUrl);
  const W = 160;
  const H = Math.max(1, Math.round((img.naturalHeight / img.naturalWidth) * W));
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('Canvas is not available');
  ctx.drawImage(img, 0, 0, W, H);
  const { data } = ctx.getImageData(0, 0, W, H);
  const px = (x: number, y: number) => {
    const i = (y * W + x) * 4;
    return [data[i], data[i + 1], data[i + 2]];
  };

  // Background estimate from the outer ring
  const border: number[][] = [];
  const ring = Math.max(2, Math.round(W * 0.06));
  for (let y = 0; y < H; y += 2) for (let x = 0; x < W; x += 2) if (x < ring || x > W - ring || y < ring || y > H - ring) border.push(px(x, y));
  const bg = border.reduce((s, p) => [s[0] + p[0], s[1] + p[1], s[2] + p[2]], [0, 0, 0]).map((v) => v / Math.max(1, border.length));

  // Samples from the central body region
  const samples: number[][] = [];
  for (let y = Math.round(H * 0.25); y < Math.round(H * 0.85); y++) for (let x = Math.round(W * 0.1); x < Math.round(W * 0.9); x++) samples.push(px(x, y));
  if (!samples.length) return { dominant: '#9aa3ad', palette: [], aspect: img.naturalWidth / img.naturalHeight, orientation: 'square' };

  // k-means (k = 5)
  const K = 5;
  let centers = Array.from({ length: K }, (_, i) => samples[Math.floor(((i + 0.5) / K) * samples.length)].slice());
  const assign = new Array(samples.length).fill(0);
  for (let it = 0; it < 10; it++) {
    for (let i = 0; i < samples.length; i++) {
      let best = 0, bd = Infinity;
      for (let k = 0; k < K; k++) {
        const d = dist(samples[i], centers[k]);
        if (d < bd) { bd = d; best = k; }
      }
      assign[i] = best;
    }
    const sums = Array.from({ length: K }, () => [0, 0, 0, 0]);
    for (let i = 0; i < samples.length; i++) {
      const s = sums[assign[i]];
      s[0] += samples[i][0]; s[1] += samples[i][1]; s[2] += samples[i][2]; s[3]++;
    }
    centers = sums.map((s, k) => (s[3] ? [s[0] / s[3], s[1] / s[3], s[2] / s[3]] : centers[k]));
  }
  const counts = new Array(K).fill(0);
  for (const a of assign) counts[a]++;
  const scored = centers.map((c, k) => {
    const lum = 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
    const sat = Math.max(...c) - Math.min(...c);
    let w = counts[k];
    if (dist(c, bg) < 42) w *= 0.35; // looks like background
    if (lum < 32) w *= 0.6; // tyres, glass, deep shadow
    if (lum > 238 && sat < 18) w *= 0.7; // sky / specular highlights
    return { c, w, pct: counts[k] / samples.length };
  });
  scored.sort((a, b) => b.w - a.w);
  const aspect = img.naturalWidth / img.naturalHeight;
  return {
    dominant: hex(scored[0].c[0], scored[0].c[1], scored[0].c[2]),
    palette: [...scored].sort((a, b) => b.pct - a.pct).map((s) => ({ hex: hex(s.c[0], s.c[1], s.c[2]), pct: Math.round(s.pct * 100) })),
    aspect,
    orientation: aspect > 1.15 ? 'landscape' : aspect < 0.87 ? 'portrait' : 'square',
  };
}
