import { useLayoutEffect, useRef } from 'react';
import { useCurrentFrame, useVideoConfig } from 'remotion';
import { Camera, Vec3, RGB, shade, fogColor, SUN_DIR, sub, dot, normalize } from './engine';
import { buildScene, cameraForFrame } from './egyptScene';

function drawSky(ctx: CanvasRenderingContext2D, width: number, height: number, sunScreen: [number, number] | null) {
  const grad = ctx.createLinearGradient(0, 0, 0, height);
  grad.addColorStop(0, '#1d3a6e');
  grad.addColorStop(0.45, '#5a7fb8');
  grad.addColorStop(0.72, '#f2c08a');
  grad.addColorStop(1, '#f7d9b4');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, width, height);

  if (sunScreen) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const disk = ctx.createRadialGradient(sunScreen[0], sunScreen[1], 0, sunScreen[0], sunScreen[1], 46);
    disk.addColorStop(0, 'rgba(255,250,235,1)');
    disk.addColorStop(0.35, 'rgba(255,224,170,0.85)');
    disk.addColorStop(1, 'rgba(255,200,130,0)');
    ctx.fillStyle = disk;
    ctx.beginPath();
    ctx.arc(sunScreen[0], sunScreen[1], 46, 0, Math.PI * 2);
    ctx.fill();

    const glow = ctx.createRadialGradient(sunScreen[0], sunScreen[1], 0, sunScreen[0], sunScreen[1], 320);
    glow.addColorStop(0, 'rgba(255,190,110,0.35)');
    glow.addColorStop(0.5, 'rgba(255,170,90,0.12)');
    glow.addColorStop(1, 'rgba(255,150,80,0)');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(sunScreen[0], sunScreen[1], 320, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = 'rgba(255,214,160,0.28)';
    ctx.lineWidth = 2;
    for (let i = 1; i <= 5; i++) {
      const spread = i * 34;
      ctx.beginPath();
      ctx.moveTo(sunScreen[0] - spread, sunScreen[1] - spread * 0.22);
      ctx.lineTo(sunScreen[0] + spread, sunScreen[1] + spread * 0.22);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(sunScreen[0] + spread * 0.3, sunScreen[1] - spread * 0.32);
      ctx.lineTo(sunScreen[0] - spread * 0.7, sunScreen[1] + spread * 0.32);
      ctx.stroke();
    }
    ctx.restore();
  }
}

function drawVignette(ctx: CanvasRenderingContext2D, width: number, height: number) {
  const grad = ctx.createRadialGradient(
    width / 2,
    height * 0.45,
    Math.min(width, height) * 0.35,
    width / 2,
    height * 0.45,
    Math.max(width, height) * 0.72,
  );
  grad.addColorStop(0, 'rgba(0,0,0,0)');
  grad.addColorStop(1, 'rgba(8,4,0,0.5)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, width, height);
}

export function EgyptCinematic() {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useLayoutEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;

    if (canvas.width !== width) canvas.width = width;
    if (canvas.height !== height) canvas.height = height;

    const t = frame / fps;
    const { position, target } = cameraForFrame(frame, fps);
    const cam = new Camera(position, target, 50);

    const scene = buildScene(cam, t);
    const quads = scene.quads;

    // Painter's algorithm: far quads first.
    quads.sort((a, b) => {
      let za = 0;
      let zb = 0;
      for (const p of a.points) za += cam.depth(p);
      for (const p of b.points) zb += cam.depth(p);
      return zb - za;
    });

    const sunFar = [SUN_DIR[0] * 1500, SUN_DIR[1] * 1500, SUN_DIR[2] * 1500] as Vec3;
    const sunProj = cam.project(sunFar, width, height);
    drawSky(ctx, width, height, sunProj ? [sunProj[0], sunProj[1]] : null);

    for (const q of quads) {
      const proj = q.points.map((p) => cam.project(p, width, height));
      if (proj.some((p) => p === null)) continue;
      const pts = proj as Array<[number, number, number]>;

      if (q.solid) {
        const center: Vec3 = [
          (q.points[0][0] + q.points[1][0] + q.points[2][0] + q.points[3][0]) / 4,
          (q.points[0][1] + q.points[1][1] + q.points[2][1] + q.points[3][1]) / 4,
          (q.points[0][2] + q.points[1][2] + q.points[2][2] + q.points[3][2]) / 4,
        ];
        const toCam = normalize(sub(cam.position, center));
        if (dot(q.normal, toCam) <= 0) continue;
      }

      const shaded = shade(q.normal, q.color) as RGB;
      const avgDepth = (pts[0][2] + pts[1][2] + pts[2][2] + pts[3][2]) / 4;
      const fogged = fogColor(shaded, avgDepth);
      const [r, g, b] = fogged;
      ctx.fillStyle = `rgb(${r},${g},${b})`;
      ctx.beginPath();
      ctx.moveTo(pts[0][0], pts[0][1]);
      for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
      ctx.closePath();
      ctx.fill();
    }

    drawVignette(ctx, width, height);
  }, [frame, fps, width, height]);

  return <canvas ref={canvasRef} style={{ width: '100%', height: '100%', display: 'block' }} />;
}
