import React from 'react';
import {interpolate} from 'remotion';

// Black stickman - cinematic style
// Pure black ink with rim light, white eyes, minimal face
// Deterministic, no random

type Pose = 'stand' | 'slump' | 'phone' | 'point' | 'carry' | 'handUp' | 'openDoor' | 'type';

type StickmanProps = {
  x: number;
  y: number;
  scale?: number;
  facing?: 1 | -1;
  pose?: Pose;
  expression?: 'neutral' | 'hesitate' | 'smile' | 'irritated' | 'worried' | 'relieved' | 'thinking';
  rimLight?: string;
  progress?: number; // 0-1 for pose blending
  opacity?: number;
};

export const Stickman: React.FC<StickmanProps> = ({
  x,
  y,
  scale = 1,
  facing = 1,
  pose = 'stand',
  expression = 'neutral',
  rimLight = '#ffbe3d',
  opacity = 1,
}) => {
  const s = scale;
  // Head
  const headR = 26 * s;
  const headY = y - 95 * s;
  const headX = x;

  // Pose offsets
  let armAngleL = 0;
  let armAngleR = 0;
  let legAngleL = 0;
  let legAngleR = 0;
  let bodyLean = 0;

  switch (pose) {
    case 'slump':
      armAngleL = 0.6;
      armAngleR = 0.5;
      legAngleL = 0.2;
      legAngleR = -0.1;
      bodyLean = 0.25;
      break;
    case 'phone':
      armAngleR = -0.9; // holding phone
      armAngleL = 0.2;
      break;
    case 'point':
      armAngleR = -1.2;
      armAngleL = 0.3;
      break;
    case 'carry':
      armAngleL = -0.6;
      armAngleR = -0.7;
      bodyLean = 0.15;
      break;
    case 'handUp':
      armAngleR = -2.0;
      armAngleL = 0.1;
      break;
    case 'openDoor':
      armAngleR = -0.7;
      armAngleL = -0.8;
      break;
    case 'type':
      armAngleL = -0.5;
      armAngleR = -0.5;
      break;
    default:
      armAngleL = 0.15;
      armAngleR = -0.15;
      break;
  }

  // Face details based on expression
  let eyeOffsetY = 0;
  let mouth = '—';
  let brow = 0;

  switch (expression) {
    case 'hesitate':
      eyeOffsetY = 1;
      mouth = '~';
      brow = -4;
      break;
    case 'irritated':
      eyeOffsetY = -1;
      mouth = '¬';
      brow = -6;
      break;
    case 'worried':
      eyeOffsetY = 2;
      mouth = 'o';
      brow = 4;
      break;
    case 'smile':
      mouth = '⌣';
      brow = 0;
      break;
    case 'relieved':
      mouth = '‿';
      brow = 2;
      break;
    case 'thinking':
      mouth = '–';
      brow = -2;
      break;
    default:
      mouth = '–';
      brow = 0;
  }

  const bodyTopY = headY + headR + 6 * s;
  const bodyBottomY = y - 22 * s;
  const bodyLen = bodyBottomY - bodyTopY;
  const leftShoulderX = headX - 3 * s;
  const rightShoulderX = headX + 3 * s;

  // Simple limb endpoints
  const armLen = 42 * s;
  const legLen = 48 * s;

  const armLx = leftShoulderX + Math.sin(armAngleL) * armLen * facing;
  const armLy = bodyTopY + 10 * s + Math.cos(armAngleL) * armLen;
  const armRx = rightShoulderX + Math.sin(armAngleR) * armLen * facing;
  const armRy = bodyTopY + 10 * s + Math.cos(armAngleR) * armLen;

  const hipX = headX;
  const hipY = bodyBottomY;
  const legLx = hipX - 8 * s + Math.sin(legAngleL) * legLen * 0.5;
  const legLy = hipY + Math.cos(legAngleL) * legLen;
  const legRx = hipX + 8 * s + Math.sin(legAngleR) * legLen * 0.5;
  const legRy = hipY + Math.cos(legAngleR) * legLen;

  return (
    <g opacity={opacity} transform={`translate(${x}, ${y}) scale(${facing},1) translate(${-x},${-y})`}>
      {/* Contact shadow */}
      <ellipse
        cx={x}
        cy={y + 6 * s}
        rx={28 * s}
        ry={7 * s}
        fill="#000"
        opacity={0.22}
      />

      {/* Legs */}
      <line
        x1={hipX - 6 * s}
        y1={hipY}
        x2={legLx - 6 * s}
        y2={legLy}
        stroke="#0a0a0a"
        strokeWidth={13 * s}
        strokeLinecap="round"
      />
      <line
        x1={hipX + 6 * s}
        y1={hipY}
        x2={legRx + 6 * s}
        y2={legRy}
        stroke="#2a1e35"
        strokeWidth={11 * s}
        strokeLinecap="round"
        opacity={0.95}
      />
      {/* Body */}
      <line
        x1={headX}
        y1={bodyTopY}
        x2={hipX + bodyLean * 22 * s}
        y2={hipY}
        stroke="#0a0a0a"
        strokeWidth={15 * s}
        strokeLinecap="round"
      />
      {/* Arms */}
      <line
        x1={leftShoulderX}
        y1={bodyTopY + 8 * s}
        x2={armLx}
        y2={armLy}
        stroke="#0a0a0a"
        strokeWidth={12 * s}
        strokeLinecap="round"
      />
      <line
        x1={rightShoulderX}
        y1={bodyTopY + 8 * s}
        x2={armRx}
        y2={armRy}
        stroke="#0a0a0a"
        strokeWidth={12 * s}
        strokeLinecap="round"
      />

      {/* Rim light on body - thin line on light side */}
      <line
        x1={headX + (facing > 0 ? headR - 2 * s : -headR + 2 * s)}
        y1={headY - headR * 0.2}
        x2={hipX + bodyLean * 22 * s + (facing > 0 ? 4 * s : -4 * s)}
        y2={hipY}
        stroke={rimLight}
        strokeWidth={2.5 * s}
        strokeLinecap="round"
        opacity={0.75}
      />

      {/* Head */}
      <circle cx={headX} cy={headY} r={headR} fill="#0a0a0a" stroke={rimLight} strokeWidth={2 * s} />
      {/* Rim crescent on head */}
      <path
        d={`M ${headX + (facing > 0 ? headR * 0.55 : -headR * 0.55)} ${headY - headR * 0.6} A ${headR * 0.9} ${headR * 0.9} 0 0 ${facing > 0 ? 1 : 0} ${headX + (facing > 0 ? headR * 0.7 : -headR * 0.7)} ${headY + headR * 0.4}`}
        stroke={rimLight}
        strokeWidth={2.2 * s}
        fill="none"
        opacity={0.9}
        strokeLinecap="round"
      />

      {/* Eyes */}
      <g transform={`translate(0, ${eyeOffsetY})`}>
        <circle cx={headX - 9 * s} cy={headY - 4 * s} r={3.2 * s} fill="#ffffff" />
        <circle cx={headX + 9 * s} cy={headY - 4 * s} r={3.2 * s} fill="#ffffff" />
        <circle cx={headX - 9 * s + brow * 0.15} cy={headY - 4 * s} r={1.4 * s} fill="#0a0a0a" />
        <circle cx={headX + 9 * s + brow * 0.15} cy={headY - 4 * s} r={1.4 * s} fill="#0a0a0a" />
        {/* Brows */}
        <line
          x1={headX - 14 * s}
          y1={headY - 10 * s + brow * 0.3}
          x2={headX - 4 * s}
          y2={headY - 10 * s + brow * 0.1}
          stroke="#ffffff"
          strokeWidth={1.6 * s}
          strokeLinecap="round"
          opacity={0.95}
        />
        <line
          x1={headX + 4 * s}
          y1={headY - 10 * s + brow * 0.1}
          x2={headX + 14 * s}
          y2={headY - 10 * s + brow * 0.3}
          stroke="#ffffff"
          strokeWidth={1.6 * s}
          strokeLinecap="round"
          opacity={0.95}
        />
      </g>
      {/* Mouth */}
      <g transform={`translate(${headX}, ${headY + 10 * s})`}>
        {mouth === '⌣' && (
          <path
            d={`M ${-7 * s} 0 Q 0 ${5 * s} ${7 * s} 0`}
            stroke="#ffffff"
            strokeWidth={1.8 * s}
            fill="none"
            strokeLinecap="round"
          />
        )}
        {mouth === '‿' && (
          <path
            d={`M ${-6 * s} 0 Q 0 ${3 * s} ${6 * s} 0`}
            stroke="#ffffff"
            strokeWidth={1.6 * s}
            fill="none"
            strokeLinecap="round"
            opacity={0.9}
          />
        )}
        {mouth === 'o' && <ellipse cx={0} cy={0} rx={3 * s} ry={4 * s} fill="#ffffff" opacity={0.95} />}
        {(mouth === '–' || mouth === '~' || mouth === '—' || mouth === '¬') && (
          <line
            x1={-6 * s}
            y1={0}
            x2={6 * s}
            y2={mouth === '¬' ? -2 * s : 0}
            stroke="#ffffff"
            strokeWidth={1.7 * s}
            strokeLinecap="round"
          />
        )}
      </g>

      {/* Phone prop when needed */}
      {pose === 'phone' && (
        <g transform={`translate(${armRx}, ${armRy})`}>
          <rect x={-10 * s} y={-16 * s} width={20 * s} height={32 * s} rx={3 * s} fill="#1a233a" stroke="#4a6fa5" strokeWidth={1.2 * s} />
          <rect x={-8 * s} y={-12 * s} width={16 * s} height={20 * s} rx={1.5 * s} fill="#8ecbff" opacity={0.95} />
          <circle cx={0} cy={10 * s} r={2 * s} fill="#4a6fa5" />
        </g>
      )}
      {pose === 'carry' && (
        <g transform={`translate(${x + 18 * facing * s}, ${y - 38 * s})`}>
          <rect x={-28 * s} y={-18 * s} width={56 * s} height={36 * s} rx={3 * s} fill="#2a1810" stroke="#d46a32" strokeWidth={1.5 * s} />
          <text
            x={0}
            y={4 * s}
            textAnchor="middle"
            fontSize={9 * s}
            fontWeight={800}
            fill="#ff8c42"
            style={{fontFamily: 'Inter, system-ui, sans-serif', letterSpacing: 0.5}}
          >
            PROMISES
          </text>
        </g>
      )}
    </g>
  );
};

// Small animated dust particles - deterministic
export const Dust: React.FC<{frame: number}> = ({frame}) => {
  const dots = [0, 1, 2, 3, 4, 5, 6, 7].map((i) => {
    const x = 200 + ((i * 197) % 1520);
    const y = 120 + ((i * 331) % 760);
    const drift = Math.sin(frame * 0.02 + i) * 6;
    const opacity = 0.18 + Math.sin(frame * 0.03 + i * 1.1) * 0.08;
    return <circle key={i} cx={x + drift} cy={y} r={1.2} fill="#ffdc9b" opacity={opacity} />;
  });
  return <g>{dots}</g>;
};

export const Letterbox: React.FC<{bars: 'wide' | 'scope' | 'none'}> = ({bars}) => {
  if (bars === 'none') return null;
  const h = bars === 'scope' ? 72 : 46;
  return (
    <>
      <div style={{position: 'absolute', top: 0, left: 0, right: 0, height: h, background: '#000', zIndex: 10}} />
      <div style={{position: 'absolute', bottom: 0, left: 0, right: 0, height: h, background: '#000', zIndex: 10}} />
    </>
  );
};
