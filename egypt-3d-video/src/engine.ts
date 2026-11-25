// A compact software 3D renderer on Canvas 2D: perspective projection,
// painter's-algorithm depth sorting, flat shading, exponential fog.
// No WebGL required — runs in any headless browser.

export type Vec3 = [number, number, number];

export const sub = (a: Vec3, b: Vec3): Vec3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
export const add = (a: Vec3, b: Vec3): Vec3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
export const scale = (a: Vec3, s: number): Vec3 => [a[0] * s, a[1] * s, a[2] * s];

export const dot = (a: Vec3, b: Vec3): number => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

export const cross = (a: Vec3, b: Vec3): Vec3 => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];

export const length = (a: Vec3): number => Math.hypot(a[0], a[1], a[2]);

export const normalize = (a: Vec3): Vec3 => {
  const l = length(a) || 1;
  return [a[0] / l, a[1] / l, a[2] / l];
};

export const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;
export const clamp = (v: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, v));
export const smoothstep = (e0: number, e1: number, x: number): number => {
  const t = clamp((x - e0) / (e1 - e0), 0, 1);
  return t * t * (3 - 2 * t);
};

export type RGB = [number, number, number];

// ---------------------------------------------------------------------------
// Camera
// ---------------------------------------------------------------------------
export class Camera {
  position: Vec3;
  target: Vec3;
  fov: number;
  right: Vec3 = [1, 0, 0];
  up: Vec3 = [0, 1, 0];
  forward: Vec3 = [0, 0, 1];

  constructor(position: Vec3, target: Vec3, fov = 50) {
    this.position = position;
    this.target = target;
    this.fov = fov;
    this.update();
  }

  update() {
    this.forward = normalize(sub(this.target, this.position));
    const worldUp: Vec3 = [0, 1, 0];
    this.right = normalize(cross(this.forward, worldUp));
    this.up = cross(this.right, this.forward);
  }

  /** Projects a world point to screen pixels; returns null if behind camera. */
  project(p: Vec3, width: number, height: number): [number, number, number] | null {
    const rel = sub(p, this.position);
    const z = dot(rel, this.forward);
    if (z <= 0.2) return null;
    const focal = (height / 2) / Math.tan((this.fov * Math.PI) / 360);
    const x = width / 2 + (dot(rel, this.right) * focal) / z;
    const y = height / 2 - (dot(rel, this.up) * focal) / z;
    return [x, y, z];
  }

  /** Camera-space depth of a world point (larger = farther). */
  depth(p: Vec3): number {
    return dot(sub(p, this.position), this.forward);
  }
}

// ---------------------------------------------------------------------------
// Render items
// ---------------------------------------------------------------------------
export interface Quad {
  points: Vec3[]; // 4 corners (world space)
  normal: Vec3;
  color: RGB;
  solid: boolean; // closed-object quads cull backfaces; terrain/sprites don't
}

export interface RenderList {
  quads: Quad[];
}

export function pushQuad(list: RenderList, a: Vec3, b: Vec3, c: Vec3, d: Vec3, normal: Vec3, color: RGB, solid = false) {
  list.quads.push({ points: [a, b, c, d], normal, color, solid });
}

/** Box centered at `center`, sized sx x sy x sz (local axes). */
export function pushBox(list: RenderList, center: Vec3, sx: number, sy: number, sz: number, color: RGB) {
  const [cx, cy, cz] = center;
  const hx = sx / 2, hy = sy / 2, hz = sz / 2;
  // 6 faces with outward normals
  const faces: Array<{ n: Vec3; v: Vec3[] }> = [
    { n: [1, 0, 0], v: [[cx + hx, cy - hy, cz - hz], [cx + hx, cy + hy, cz - hz], [cx + hx, cy + hy, cz + hz], [cx + hx, cy - hy, cz + hz]] },
    { n: [-1, 0, 0], v: [[cx - hx, cy - hy, cz + hz], [cx - hx, cy + hy, cz + hz], [cx - hx, cy + hy, cz - hz], [cx - hx, cy - hy, cz - hz]] },
    { n: [0, 1, 0], v: [[cx - hx, cy + hy, cz - hz], [cx + hx, cy + hy, cz - hz], [cx + hx, cy + hy, cz + hz], [cx - hx, cy + hy, cz + hz]] },
    { n: [0, -1, 0], v: [[cx - hx, cy - hy, cz + hz], [cx + hx, cy - hy, cz + hz], [cx + hx, cy - hy, cz - hz], [cx - hx, cy - hy, cz - hz]] },
    { n: [0, 0, 1], v: [[cx - hx, cy - hy, cz + hz], [cx + hx, cy - hy, cz + hz], [cx + hx, cy + hy, cz + hz], [cx - hx, cy + hy, cz + hz]] },
    { n: [0, 0, -1], v: [[cx + hx, cy - hy, cz - hz], [cx - hx, cy - hy, cz - hz], [cx - hx, cy + hy, cz - hz], [cx + hx, cy + hy, cz - hz]] },
  ];
  for (const f of faces) pushQuad(list, ...f.v, f.n, color, true);
}

// ---------------------------------------------------------------------------
// Shading & fog
// ---------------------------------------------------------------------------
export const SUN_DIR: Vec3 = normalize([0.22, 0.15, -0.96]);
export const HORIZON_COLOR: RGB = [232, 201, 166];

export function shade(normal: Vec3, base: RGB, sun = SUN_DIR): RGB {
  const lambert = Math.max(0, dot(normal, sun));
  const skyFill = 0.5 + 0.5 * Math.max(0, normal[1]);
  const k = 0.18 + 0.82 * (lambert * 0.85 + skyFill * 0.15);
  return [Math.round(base[0] * k), Math.round(base[1] * k), Math.round(base[2] * k)];
}

export function fogColor(c: RGB, depth: number): RGB {
  const t = clamp(1 - Math.exp(-depth * 0.0038), 0, 0.92);
  return [
    Math.round(lerp(c[0], HORIZON_COLOR[0], t)),
    Math.round(lerp(c[1], HORIZON_COLOR[1], t)),
    Math.round(lerp(c[2], HORIZON_COLOR[2], t)),
  ];
}
