// Egyptian scene built for the software 3D engine: infinite dune terrain,
// the three pyramids, a sphinx colossus, palms, and a fully rigged human
// figure animated with a walk cycle (forward kinematics over the joint tree).
import {
  Camera,
  RenderList,
  pushBox,
  pushQuad,
  Quad,
  Vec3,
  RGB,
  normalize,
  sub,
  add,
  scale,
  dot,
  cross,
  length,
  lerp,
  smoothstep,
  clamp,
  shade,
  SUN_DIR,
} from './engine';
import { fbm, mulberry32 } from './util';

// ===========================================================================
// Terrain (precomputed once)
// ===========================================================================
const T_SIZE = 760;
const T_STEP = 9.5;

interface TerrainVertex {
  pos: Vec3;
  color: RGB;
  normal: Vec3;
}

const TERRAIN: { verts: TerrainVertex[]; cols: number; rows: number; step: number; half: number } = (() => {
  const cols = Math.round(T_SIZE / T_STEP) + 1;
  const rows = cols;
  const verts: TerrainVertex[] = [];
  const half = T_SIZE / 2;
  const rng = mulberry32(7);

  for (let j = 0; j < rows; j++) {
    for (let i = 0; i < cols; i++) {
      const x = -half + i * T_STEP;
      const z = -half + j * T_STEP;
      const wave = fbm(x * 0.0035, 0, z * 0.0035, 4) - 0.5;
      const ripple = fbm(x * 0.05, 0, z * 0.05, 2) - 0.5;
      const h = wave * 14 + ripple * 1.1;
      const dist = Math.sqrt(x * x + z * z) / half;
      const rimFall = smoothstep(0.5, 1.0, dist) * 7;
      const y = h - rimFall;

      const n = fbm(x * 0.02, 0, z * 0.02, 3);
      let c: RGB = [217, 180, 135]; // sand low
      if (h > 3) c = [lerp(c[0], 201, smoothstep(3, 8, h)), lerp(c[1], 154, smoothstep(3, 8, h)), lerp(c[2], 109, smoothstep(3, 8, h))] as RGB;
      if (h > 6) c = [lerp(c[0], 176, smoothstep(6, 11, h)), lerp(c[1], 130, smoothstep(6, 11, h)), lerp(c[2], 79, smoothstep(6, 11, h))] as RGB;
      const grain = rng() * 0.06;
      c = [
        clamp(c[0] * (1 + grain - 0.04 + n * 0.04), 0, 255),
        clamp(c[1] * (1 + grain - 0.04 + n * 0.04), 0, 255),
        clamp(c[2] * (1 + grain - 0.04 + n * 0.04), 0, 255),
      ];
      verts.push({ pos: [x, y, z], color: c, normal: [0, 1, 0] });
    }
  }

  // Normals from finite differences.
  for (let j = 0; j < rows; j++) {
    for (let i = 0; i < cols; i++) {
      const v = verts[j * cols + i];
      const l = verts[j * cols + Math.max(0, i - 1)];
      const r = verts[j * cols + Math.min(cols - 1, i + 1)];
      const d = verts[Math.min(rows - 1, j + 1) * cols + i];
      const u = verts[Math.max(0, j - 1) * cols + i];
      const nx = (l.pos[0] - r.pos[0]);
      const nz = (u.pos[2] - d.pos[2]);
      const ny = ((l.pos[1] - r.pos[1]) * (u.pos[2] - d.pos[2]) - (u.pos[1] - d.pos[1]) * (l.pos[0] - r.pos[0]));
      v.normal = normalize([nx, ny, nz]);
    }
  }
  return { verts, cols, rows, step: T_STEP, half };
})();

function buildTerrain(list: RenderList) {
  const { verts, cols, rows, step } = TERRAIN;
  for (let j = 0; j < rows - 1; j++) {
    for (let i = 0; i < cols - 1; i++) {
      const v00 = verts[j * cols + i];
      const v10 = verts[j * cols + i + 1];
      const v11 = verts[(j + 1) * cols + i + 1];
      const v01 = verts[(j + 1) * cols + i];
      const avgColor: RGB = [
        (v00.color[0] + v10.color[0] + v11.color[0] + v01.color[0]) / 4,
        (v00.color[1] + v10.color[1] + v11.color[1] + v01.color[1]) / 4,
        (v00.color[2] + v10.color[2] + v11.color[2] + v01.color[2]) / 4,
      ];
      pushQuad(list, v00.pos, v10.pos, v11.pos, v01.pos, v00.normal, avgColor);
      void step;
    }
  }
}

// ===========================================================================
// Pyramids
// ===========================================================================
function buildPyramid(list: RenderList, cx: number, cz: number, base: number, height: number) {
  const apex: Vec3 = [cx, height, cz];
  const half = base / 2;
  // Four triangular faces (outward normals), limestone colors.
  const lime: RGB = [205, 188, 150];
  const corners: Vec3[] = [
    [cx - half, 0, cz - half],
    [cx + half, 0, cz - half],
    [cx + half, 0, cz + half],
    [cx - half, 0, cz + half],
  ];
  for (let i = 0; i < 4; i++) {
    const a = corners[i];
    const b = corners[(i + 1) % 4];
    const n = normalize(cross(sub(b, a), sub(apex, a)));
    const shaded = shade(n, lime);
    pushQuad(list, a, b, apex, apex, n, shaded, true);
  }
  // Darker casing base.
  pushBox(list, [cx, height * 0.02, cz], base * 1.06, height * 0.08, base * 1.06, [156, 133, 96]);
  // Contact shadow ellipse on the sand.
  const shadow: RGB = [48, 30, 14];
  pushQuad(
    list,
    [cx - base * 0.8, 0.2, cz - base * 0.35],
    [cx + base * 0.8, 0.2, cz - base * 0.35],
    [cx + base * 0.8, 0.2, cz + base * 0.35],
    [cx - base * 0.8, 0.2, cz + base * 0.35],
    [0, 1, 0],
    shadow,
  );
}

function buildPyramids(list: RenderList) {
  buildPyramid(list, -48, -190, 78, 52);
  buildPyramid(list, 24, -215, 64, 44);
  buildPyramid(list, 60, -180, 52, 36);
}

// ===========================================================================
// Sphinx (box assemblies)
// ===========================================================================
function buildSphinx(list: RenderList) {
  const stone: RGB = [216, 198, 164];
  const boxes: Array<[Vec3, number, number, number]> = [
    [[-2, 7, 0], 26, 7, 7],
    [[6, 3.5, 0], 8, 6, 9],
    [[-6, 3.5, 0], 8, 6, 9],
    [[-16, 4.5, 0], 6, 3, 4],
    [[8, 7, 0], 10, 8, 9],
    [[13.5, 11, 0], 4, 7, 5],
    [[16, 17, 0], 6, 7.5, 6.5],
    [[16, 21, 0], 7.4, 2.2, 7.4],
    [[11, 1.1, 4.5], 5, 2.2, 5],
    [[11, 1.1, -4.5], 5, 2.2, 5],
    [[-2, 0.75, 0], 34, 1.5, 11],
  ];
  for (const [c, sx, sy, sz] of boxes) {
    pushBox(list, add([-16, -10, -165], c), sx * 1.15, sy * 1.15, sz * 1.15, stone);
  }
  // Contact shadow.
  pushQuad(
    list,
    [-40, 0.2, -165 - 8],
    [4, 0.2, -165 - 8],
    [4, 0.2, -165 + 8],
    [-40, 0.2, -165 + 8],
    [0, 1, 0],
    [48, 30, 14],
  );
}

// ===========================================================================
// Palm trees
// ===========================================================================
function buildPalm(list: RenderList, x: number, z: number) {
  const rng = mulberry32(Math.round((x + z) * 137) % 1000);
  const top = 12.5;
  // Trunk: tapered stack of boxes with a slight lean.
  const segs = 6;
  for (let i = 0; i < segs; i++) {
    const t = i / segs;
    const y = 2.5 + t * (top - 2.5);
    const r = 0.55 - 0.22 * t;
    pushBox(list, [x + 0.15 * t, y, z], r * 1.4, 2.2, r * 1.4, [122, 90, 54]);
  }
  // Fronds.
  const fronds = 9;
  for (let i = 0; i < fronds; i++) {
    const angle = (i / fronds) * Math.PI * 2 + rng() * 0.2;
    const len = 5.5 + rng() * 1.5;
    const droop = 0.55 + rng() * 0.35;
    const dx = Math.cos(angle) * len * 0.7;
    const dz = Math.sin(angle) * len * 0.7;
    const tipY = top - len * droop;
    const base: Vec3 = [x + 0.15, top, z];
    const tip: Vec3 = [x + 0.15 + dx, tipY, z + dz];
    const side = 0.5;
    const n = normalize(cross(sub(tip, base), [0, 1, 0]));
    pushQuad(list, base, [base[0] + n[0] * side, base[1], base[2] + n[2] * side], tip, [tip[0] + n[0] * side, tip[1], tip[2] + n[2] * side], n, [79, 122, 58]);
  }
  pushQuad(
    list,
    [x - 4.5, 0.2, z - 2],
    [x + 4.5, 0.2, z - 2],
    [x + 4.5, 0.2, z + 2],
    [x - 4.5, 0.2, z + 2],
    [0, 1, 0],
    [53, 33, 16],
  );
}

function buildPalms(list: RenderList) {
  for (const [x, z] of [
    [-118, -30],
    [-128, -55],
    [108, -42],
    [96, -70],
  ]) {
    buildPalm(list, x, z);
  }
}

// ===========================================================================
// Rigged human — forward kinematics over a joint tree
// ===========================================================================
type Euler = [number, number, number]; // rotation order: Z (swing), X (tilt), Y (turn)

interface Bone {
  parent: number; // index of parent bone, -1 = root
  offset: Vec3; // origin in parent space
  rot: Euler; // per-frame local rotation
  size: [number, number, number];
  color: RGB;
}

function rotMul(a: number[], b: number[]): number[] {
  const r = new Array(9).fill(0);
  for (let i = 0; i < 3; i++)
    for (let j = 0; j < 3; j++)
      for (let k = 0; k < 3; k++) r[i * 3 + j] += a[i * 3 + k] * b[k * 3 + j];
  return r;
}

function rotFromEuler(z: number, x: number, y: number): number[] {
  const cz = Math.cos(z), sz = Math.sin(z);
  const cx = Math.cos(x), sx = Math.sin(x);
  const cy = Math.cos(y), sy = Math.sin(y);
  // R = Rz * Rx * Ry
  return [
    cz * cx, cz * sx * sy - sz * cy, cz * sx * cy + sz * sy,
    sz * cx, sz * sx * sy + cz * cy, sz * sx * cy - cz * sy,
    -sx, cx * sy, cx * cy,
  ];
}

function applyM(m: number[], p: Vec3): Vec3 {
  return [
    m[0] * p[0] + m[1] * p[1] + m[2] * p[2],
    m[3] * p[0] + m[4] * p[1] + m[5] * p[2],
    m[6] * p[0] + m[7] * p[1] + m[8] * p[2],
  ];
}

function applyNormal(m: number[], n: Vec3): Vec3 {
  return normalize(applyM(m, n));
}

/** Walk-cycle pose, mirroring the original 3D rig (2 strides over 3 s). */
export function walkPose(t: number) {
  const phase = t * Math.PI * 2;
  const s1 = Math.sin(phase);
  const s2 = Math.sin(phase + Math.PI);
  const thigh = [s1 * 0.5, s2 * 0.5];
  const knee = [Math.max(0, -s1) * 0.95, Math.max(0, -s2) * 0.95];
  const shoulder: [number, number] = [-s1 * 0.42, -s2 * 0.42];
  const elbow: [number, number] = [Math.max(0, s1) * 0.5 + 0.25, Math.max(0, s2) * 0.5 + 0.25];
  return {
    hipY: Math.abs(Math.sin(phase * 2)) * 0.06,
    hipX: Math.sin(phase) * 0.12,
    spine: Math.sin(phase) * 0.05,
    spineTwist: Math.sin(phase * 0.5) * 0.04,
    headTurn: Math.sin(t * 0.8) * 0.12 + 0.1,
    headTilt: Math.sin(t * 0.6) * 0.04,
    shoulder,
    elbow,
    thigh,
    knee,
    foot: [Math.max(0, s1) * 0.4, Math.max(0, s2) * 0.4],
  };
}

function buildHuman(list: RenderList, t: number) {
  const p = walkPose(t);
  const rootX = lerp(-16, 10, clamp(t / 3, 0, 1));
  const rootZ = -62;
  const rot = (a: number, b: number, c: number): Euler => [a, b, c];

  const skin: RGB = [201, 142, 98];
  const skinDark: RGB = [184, 130, 90];
  const tunic: RGB = [217, 203, 176];
  const cloth: RGB = [107, 68, 38];
  const leather: RGB = [92, 58, 30];
  const nemes: RGB = [201, 146, 46];

  const bones: Bone[] = [
    // 0: pelvis (root at hip height)
    { parent: -1, offset: [rootX + p.hipX, 0.95 + p.hipY, rootZ], rot: rot(0, 0, 0), size: [0.42, 0.45, 0.26], color: skinDark },
    // 1: spine
    { parent: 0, offset: [0, 0.32, 0], rot: rot(p.spine, 0, p.spineTwist), size: [0.44, 0.7, 0.26], color: skinDark },
    // 2: chest / tunic
    { parent: 1, offset: [0, 0.45, 0], rot: rot(0, 0, 0), size: [0.5, 0.62, 0.16], color: tunic },
    // 3: head group
    { parent: 1, offset: [0, 0.92, 0], rot: rot(p.headTilt, 0, p.headTurn), size: [0.26, 0.34, 0.24], color: skin },
    // 4: nemes headcloth
    { parent: 3, offset: [0, 0.42, 0], rot: rot(0, 0, 0), size: [0.32, 0.12, 0.3], color: nemes },
    // left arm (side +1)
    { parent: 1, offset: [0.28, 0.72, 0], rot: rot(0.06, 0, 0), size: [0.1, 0.56, 0.1], color: skin },
    { parent: 5, offset: [0, -0.52, 0], rot: rot(p.shoulder[0], 0, 0), size: [0.1, 0.56, 0.1], color: skin },
    { parent: 6, offset: [0, -0.24, 0], rot: rot(p.elbow[0] + 0.3, 0, 0), size: [0.085, 0.48, 0.085], color: skin },
    { parent: 7, offset: [0, -0.52, 0.02], rot: rot(0, 0, 0), size: [0.07, 0.1, 0.14], color: skin },
    // right arm (side -1)
    { parent: 1, offset: [-0.28, 0.72, 0], rot: rot(-0.06, 0, 0), size: [0.1, 0.56, 0.1], color: skin },
    { parent: 9, offset: [0, -0.52, 0], rot: rot(p.shoulder[1], 0, 0), size: [0.1, 0.56, 0.1], color: skin },
    { parent: 10, offset: [0, -0.24, 0], rot: rot(p.elbow[1] + 0.3, 0, 0), size: [0.085, 0.48, 0.085], color: skin },
    { parent: 11, offset: [0, -0.52, 0.02], rot: rot(0, 0, 0), size: [0.07, 0.1, 0.14], color: skin },
    // left leg (side +1)
    { parent: 0, offset: [0.13, -0.02, 0], rot: rot(p.thigh[0], 0, 0), size: [0.16, 0.6, 0.16], color: skinDark },
    { parent: 13, offset: [0, -0.58, 0], rot: rot(p.knee[0], 0, 0), size: [0.12, 0.56, 0.12], color: skinDark },
    { parent: 14, offset: [0, -0.54, 0.04], rot: rot(-p.foot[0], 0, 0), size: [0.1, 0.08, 0.26], color: leather },
    // right leg (side -1)
    { parent: 0, offset: [-0.13, -0.02, 0], rot: rot(p.thigh[1], 0, 0), size: [0.16, 0.6, 0.16], color: skinDark },
    { parent: 16, offset: [0, -0.58, 0], rot: rot(p.knee[1], 0, 0), size: [0.12, 0.56, 0.12], color: skinDark },
    { parent: 17, offset: [0, -0.54, 0.04], rot: rot(-p.foot[1], 0, 0), size: [0.1, 0.08, 0.26], color: leather },
  ];

  // Loincloth on the pelvis (drawn as part of bone 0's group, offset child).
  bones.push({ parent: 0, offset: [0, -0.22, 0], rot: rot(0, 0, 0), size: [0.2, 0.3, 0.19], color: cloth });

  // Compute world matrices.
  const worlds: number[][] = [];
  for (let i = 0; i < bones.length; i++) {
    const bone = bones[i];
    const local = rotFromEuler(bone.rot[0], bone.rot[1], bone.rot[2]);
    if (bone.parent < 0) {
      worlds.push(local);
    } else {
      worlds.push(rotMul(worlds[bone.parent], local));
    }
  }

  // Emit boxes with world-space corners and normals.
  for (let i = 0; i < bones.length; i++) {
    const bone = bones[i];
    const w = worlds[i];
    const [hx, hy, hz] = bone.size.map((s) => s / 2);
    const corners: Vec3[] = [];
    for (let a = 0; a < 2; a++)
      for (let b = 0; b < 2; b++)
        for (let c = 0; c < 2; c++)
          corners.push(applyM(w, [bone.offset[0] + (a ? hx : -hx), bone.offset[1] + (b ? hy : -hy), bone.offset[2] + (c ? hz : -hz)]));
    const faces: Array<{ n: Vec3; v: number[] }> = [
      { n: [1, 0, 0], v: [0, 2, 3, 7, 4, 6] },
      { n: [-1, 0, 0], v: [1, 5, 4, 0, 7, 3] },
      { n: [0, 1, 0], v: [4, 5, 6, 7] },
      { n: [0, -1, 0], v: [0, 1, 3, 2] },
      { n: [0, 0, 1], v: [2, 6, 5, 1] },
      { n: [0, 0, -1], v: [0, 4, 7, 3] },
    ];
    for (const f of faces) {
      const n = applyNormal(w, f.n);
      pushQuad(
        list,
        corners[f.v[0]],
        corners[f.v[1]],
        corners[f.v[2]],
        corners[f.v[3]],
        n,
        bone.color,
        true,
      );
    }
  }

  // Contact shadow.
  pushQuad(
    list,
    [rootX - 1.4, 0.12, rootZ - 0.6],
    [rootX + 1.4, 0.12, rootZ - 0.6],
    [rootX + 1.4, 0.12, rootZ + 0.6],
    [rootX - 1.4, 0.12, rootZ + 0.6],
    [0, 1, 0],
    [52, 32, 16],
  );
}

// ===========================================================================
// Camera path (cinematic push-in with handheld drift)
// ===========================================================================
export function cameraForFrame(frame: number, fps: number) {
  const tt = frame / fps;
  const k = smoothstep(0, 1, Math.min(1, tt * 1.15));
  const startPos: Vec3 = [78, 32, 66];
  const endPos: Vec3 = [6, 5.5, -48];
  const startTarget: Vec3 = [0, 12, -110];
  const endTarget: Vec3 = [7, 2.2, -62];
  const shake = 0.18;
  const shx = Math.sin(tt * 4.1) * shake + Math.sin(tt * 9.7) * shake * 0.35;
  const shy = Math.sin(tt * 3.3 + 1.7) * shake * 0.8 + Math.sin(tt * 8.1) * shake * 0.3;
  const shz = Math.sin(tt * 5.2 + 0.4) * shake * 0.6;
  return {
    position: [
      startPos[0] + (endPos[0] - startPos[0]) * k + shx,
      startPos[1] + (endPos[1] - startPos[1]) * k + shy,
      startPos[2] + (endPos[2] - startPos[2]) * k + shz,
    ] as Vec3,
    target: [
      startTarget[0] + (endTarget[0] - startTarget[0]) * k,
      startTarget[1] + (endTarget[1] - startTarget[1]) * k + shy * 0.5,
      startTarget[2] + (endTarget[2] - startTarget[2]) * k + shz * 0.5,
    ] as Vec3,
  };
}

// ===========================================================================
// Full scene assembly for one frame
// ===========================================================================
export function buildScene(cam: Camera, t: number): RenderList {
  const list: RenderList = { quads: [] };
  buildTerrain(list);
  buildPyramids(list);
  buildSphinx(list);
  buildPalms(list);
  buildHuman(list, t);
  return list;
}

export { SUN_DIR, length, scale };
