import React from 'react';
import {
  AbsoluteFill,
  Sequence,
  useCurrentFrame,
  interpolate,
  Easing,
} from 'remotion';
import {ThreeCanvas} from '@remotion/three';
import {Stickman, Dust, Letterbox} from './components/Stickman';
import {RotatingCube, FloatingDoor, PromiseBox3D} from './components/ThreeElements';

// Global style constants
const BG = '#080d1a';
const BG2 = '#0f1a2e';
const CREAM = '#fff8e7';
const GOLD = '#f2c21a';
const CORAL = '#ff6b6b';
const AMBER = '#ffb84d';
const BLUE = '#6b8cff';

const serif = 'Playfair Display, Georgia, serif';
const sans = 'Inter, system-ui, -apple-system, sans-serif';

// Helper: fade in/out
const fade = (frame: number, start: number, dur: number) => {
  const p = (frame - start) / dur;
  if (p < 0.15) return interpolate(p, [0, 0.15], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.out(Easing.ease)});
  if (p > 0.85) return interpolate(p, [0.85, 1], [1, 0], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
  return 1;
};

// Hook 0-300 (10s)
const Hook: React.FC = () => {
  const frame = useCurrentFrame();
  const globalFrame = frame; // 0..300 inside sequence? Actually useCurrentFrame gives frame within composition? With Sequence, it's still global? We'll use sequential logic: this component is mounted via Sequence from 0, so frame is 0..300 relative to sequence start? In Remotion, useCurrentFrame inside Sequence still gives global frame, but we can treat as 0.. inside. Use frame as local by assuming Sequence starting point. Simpler: use frame as global but map.
  // We'll assume frame is 0..300 for hook (since Sequence from 0). So interpolate directly.
  const bubbleIn = interpolate(frame, [25, 45], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.out(Easing.back(1.2))});
  const yesScale = interpolate(frame, [110, 125], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.out(Easing.back(1.8))});
  const slumpPhase = interpolate(frame, [150, 190], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
  const chairOpacity = interpolate(frame, [160, 190], [0, 0.5], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
  const hesitation = Math.sin(frame * 0.4) * (frame > 35 && frame < 110 ? 1.2 : 0);
  const camX = interpolate(frame, [0, 300], [0, -24], {easing: Easing.inOut(Easing.ease)});
  const camZ = interpolate(frame, [0, 300], [1, 1.06], {easing: Easing.inOut(Easing.ease)});

  return (
    <AbsoluteFill style={{backgroundColor: BG}}>
      {/* Ambient background gradient */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: `radial-gradient(900px 600px at 50% 38%, #1a2a4a 0%, ${BG} 62%), linear-gradient(180deg, #0d1528 0%, ${BG} 100%)`,
        }}
      />
      {/* Window - bright area behind figure for silhouette */}
      <div
        style={{
          position: 'absolute',
          left: '50%',
          top: 140,
          width: 720,
          height: 440,
          transform: 'translateX(-50%)',
          background: 'linear-gradient(180deg, #ffcf87 0%, #ff9f6b 38%, #6b6bff 100%)',
          opacity: 0.28,
          borderRadius: 10,
          filter: 'blur(0.5px)',
        }}
      />
      <div
        style={{
          position: 'absolute',
          left: '50%',
          top: 140,
          width: 720,
          height: 440,
          transform: 'translateX(-50%)',
          border: '2px solid rgba(255,220,155,0.22)',
          borderRadius: 10,
        }}
      >
        {/* Mullions */}
        <div style={{position: 'absolute', left: '50%', top: 0, bottom: 0, width: 2, background: 'rgba(255,255,255,0.18)', transform: 'translateX(-50%)'}} />
        <div style={{position: 'absolute', top: '50%', left: 0, right: 0, height: 2, background: 'rgba(255,255,255,0.18)', transform: 'translateY(-50%)'}} />
      </div>
      {/* Dust */}
      <svg width={1920} height={1080} style={{position: 'absolute', inset: 0}}>
        <Dust frame={frame} />
      </svg>

      {/* Stickman - centered in front of window for silhouette */}
      <div style={{position: 'absolute', inset: 0, transform: `translate(${camX}px, 0) scale(${camZ})`, transformOrigin: '50% 62%'}}>
        <svg width={1920} height={1080} style={{position: 'absolute', inset: 0}}>
          <Stickman
            x={960 + hesitation}
            y={640 - slumpPhase * 18}
            scale={1.45}
            pose={frame < 150 ? 'phone' : 'slump'}
            expression={frame < 110 ? 'hesitate' : frame < 150 ? 'worried' : 'irritated'}
            rimLight="#ffb84d"
          />
        </svg>

        {/* Message bubble - above shoulder */}
        <div
          style={{
            position: 'absolute',
            left: 1060,
            top: 300,
            background: '#fff8e7',
            color: '#1a1a1a',
            padding: '16px 24px',
            borderRadius: 20,
            borderBottomLeftRadius: 4,
            fontFamily: sans,
            fontSize: 20,
            fontWeight: 700,
            transform: `scale(${bubbleIn})`,
            transformOrigin: '0% 100%',
            boxShadow: '0 12px 40px rgba(0,0,0,0.45)',
            opacity: bubbleIn,
          }}
        >
          Can you help me?{' '}
          <span style={{fontSize: 14, opacity: 0.6, fontWeight: 500}}>  • now</span>
          <div
            style={{
              position: 'absolute',
              left: -8,
              bottom: 12,
              width: 14,
              height: 14,
              background: '#fff8e7',
              transform: 'rotate(45deg)',
            }}
          />
        </div>

        {/* Yes reply - near phone */}
        <div
          style={{
            position: 'absolute',
            left: 830,
            top: 500,
            background: '#2a5bd7',
            color: 'white',
            padding: '10px 20px',
            borderRadius: 20,
            borderBottomRightRadius: 4,
            fontFamily: sans,
            fontSize: 18,
            fontWeight: 700,
            transform: `scale(${yesScale})`,
            transformOrigin: '100% 0%',
            opacity: yesScale,
          }}
        >
          yes
          <span style={{marginLeft: 8, opacity: 0.9}}>✓✓</span>
        </div>

        {/* Chair hint - subtle */}
        <div
          style={{
            position: 'absolute',
            left: 900,
            top: 700,
            width: 120,
            height: 12,
            background: '#1a233a',
            borderRadius: 6,
            opacity: chairOpacity * 0.7,
          }}
        />
      </div>

      {/* Hook text */}
      <div style={{position: 'absolute', top: 56, left: 0, right: 0, textAlign: 'center'}}>
        <div
          style={{
            display: 'inline-block',
            background: 'rgba(0,0,0,0.55)',
            backdropFilter: 'blur(8px)',
            border: '1px solid rgba(255,255,255,0.08)',
            padding: '10px 22px',
            borderRadius: 999,
            color: '#ffb84d',
            fontFamily: sans,
            fontSize: 12,
            letterSpacing: 3,
            fontWeight: 800,
          }}
        >
          SMALL TRAPS • EPISODE 1
        </div>
        <div
          style={{
            marginTop: 18,
            fontFamily: serif,
            fontSize: 46,
            fontWeight: 900,
            color: CREAM,
            letterSpacing: -1,
            lineHeight: 1.05,
            textShadow: '0 2px 20px rgba(0,0,0,0.6)',
            opacity: interpolate(frame, [8, 28], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'}),
            transform: `translateY(${interpolate(frame, [8, 28], [12, 0], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.out(Easing.ease)})}px)`,
          }}
        >
          In one second… you said <span style={{color: GOLD}}>“yes.”</span>
          <br />
          <span style={{fontSize: 30, fontWeight: 600, color: '#cbd5e8', letterSpacing: -0.5}}>And you lost your day.</span>
        </div>
      </div>

      {/* 3D inset - rotating cube representing the trap */}
      <div style={{position: 'absolute', right: 42, bottom: 110, width: 220, height: 220, borderRadius: 16, overflow: 'hidden', border: '1px solid rgba(255,184,77,0.18)', background: 'rgba(0,0,0,0.35)', backdropFilter: 'blur(8px)'}}>
        <ThreeCanvas width={220} height={220} camera={{position: [0, 0, 4.2], fov: 38}}>
          <ambientLight intensity={0.7} />
          <directionalLight position={[4, 5, 4]} intensity={1.1} color="#ffe9c2" />
          <directionalLight position={[-3, 1, -2]} intensity={0.35} color="#6b8cff" />
          <RotatingCube />
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -1.2, 0]}>
            <planeGeometry args={[6, 6]} />
            <meshStandardMaterial color="#0f1a2e" roughness={0.9} />
          </mesh>
        </ThreeCanvas>
        <div style={{position: 'absolute', bottom: 6, left: 0, right: 0, textAlign: 'center', fontFamily: sans, fontSize: 9, letterSpacing: 2, color: 'rgba(255,255,255,0.55)', fontWeight: 700}}>ONE SECOND</div>
      </div>

      <Letterbox bars="wide" />
    </AbsoluteFill>
  );
};

// Setup 300-750 (15s)
const Setup: React.FC = () => {
  const frame = useCurrentFrame();
  const local = frame;
  const brainPress = interpolate(local, [30, 65], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.out(Easing.back(1.4))});
  const clockSpin = (local * 2.2) % 360;
  const faceShift = interpolate(local, [160, 220], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
  const resentText = interpolate(local, [280, 320], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});

  return (
    <AbsoluteFill style={{backgroundColor: BG}}>
      <div style={{position: 'absolute', inset: 0, background: `radial-gradient(700px 500px at 68% 28%, #2a1a3a 0%, ${BG} 58%), linear-gradient(180deg, #0d0f1e 0%, ${BG} 100%)`}} />

      {/* Brain interior visualization */}
      <div style={{position: 'absolute', left: 120, top: 160, width: 860, height: 640, borderRadius: 24, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.07)', background: 'rgba(255,255,255,0.03)', backdropFilter: 'blur(12px)'}}>
        {/* Head cross-section */}
        <svg width={860} height={640} style={{position: 'absolute', inset: 0}}>
          {/* Large head silhouette - more proportional */}
          <ellipse cx={430} cy={340} rx={165} ry={185} fill="#0a0a0a" stroke="#ffb84d" strokeWidth={2} opacity={0.95} />
          <ellipse cx={430} cy={340} rx={165} ry={185} fill="none" stroke="#ffb84d" strokeWidth={1.2} opacity={0.14} />
          {/* Brain area */}
          <ellipse cx={430} cy={295} rx={110} ry={95} fill="#1a233a" stroke="#4a6fa5" strokeWidth={1.2} opacity={0.9} />
          <text x={430} y={302} textAnchor="middle" fontFamily={sans} fontSize={11} fontWeight={800} letterSpacing={3} fill="#8da2c0">BRAIN</text>
          {/* Tiny stickman inside brain */}
          <g transform={`translate(${430 + Math.sin(local * 0.08) * 2}, ${290}) scale(0.58)`}>
            {/* Tiny figure pressing button */}
            <circle cx={0} cy={-18} r={14} fill="#0a0a0a" stroke="#ffb84d" strokeWidth={1.2} />
            <circle cx={-4} cy={-21} r={1.6} fill="#fff" />
            <circle cx={4} cy={-21} r={1.6} fill="#fff" />
            <line x1={0} y1={-4} x2={0} y2={18} stroke="#0a0a0a" strokeWidth={7} strokeLinecap="round" />
            <line x1={0} y1={-2} x2={-14 - brainPress * 6} y2={8} stroke="#0a0a0a" strokeWidth={5} strokeLinecap="round" />
            <line x1={0} y1={-2} x2={14} y2={8} stroke="#0a0a0a" strokeWidth={5} strokeLinecap="round" />
            {/* Button */}
            <g transform={`translate(0, 42) scale(${1 - brainPress * 0.08})`}>
              <rect x={-32} y={-12} width={64} height={24} rx={12} fill={brainPress > 0.5 ? '#ff6b6b' : '#2a5bd7'} stroke="rgba(255,255,255,0.2)" strokeWidth={1} />
              <text x={0} y={4} textAnchor="middle" fontFamily={sans} fontSize={8} fontWeight={800} fill="white" letterSpacing={1}>{brainPress > 0.3 ? 'ACCEPT' : 'accept'}</text>
              {/* Press effect */}
              {brainPress > 0.6 && <circle cx={0} cy={0} r={28 + brainPress * 18} fill="none" stroke="#ff6b6b" strokeWidth={1.2} opacity={0.35 * (1 - brainPress * 0.4)} />}
            </g>
          </g>
          {/* Neurons */}
          {[0, 1, 2, 3, 4].map((i) => (
            <circle
              key={i}
              cx={380 + i * 28}
              cy={250 + Math.sin(local * 0.07 + i) * 6}
              r={2}
              fill="#ffdc9b"
              opacity={0.55}
            />
          ))}
          {/* Dust */}
          <Dust frame={local} />
        </svg>

        {/* Label */}
        <div style={{position: 'absolute', bottom: 14, left: 18, fontFamily: sans, fontSize: 10, letterSpacing: 2, fontWeight: 800, color: 'rgba(255,255,255,0.45)'}}>INSIDE THE BRAIN • PROTECTION MODE</div>
      </div>

      {/* Right side: clock */}
      <div style={{position: 'absolute', right: 120, top: 160, width: 760, height: 640}}>
        <div style={{position: 'absolute', left: 0, top: 0, right: 0, height: 320, borderRadius: 24, background: 'rgba(0,0,0,0.28)', border: '1px solid rgba(255,255,255,0.06)', overflow: 'hidden', backdropFilter: 'blur(8px)'}}>
          <div style={{position: 'absolute', left: 40, top: 26, fontFamily: sans, fontSize: 11, letterSpacing: 2, fontWeight: 800, color: '#8da2c0'}}>COST • NOT NOW • LATER</div>
          {/* Clock */}
          <div style={{position: 'absolute', left: 100, top: 70, width: 180, height: 180, borderRadius: '50%', background: '#fff8e7', border: '4px solid #1a233a', boxShadow: '0 10px 30px rgba(0,0,0,0.45)', overflow: 'hidden'}}>
            <div style={{position: 'absolute', left: '50%', top: '50%', width: 2, height: 70, background: '#1a233a', transformOrigin: '50% 100%', transform: `translate(-50%, -100%) rotate(${clockSpin}deg)`, borderRadius: 2}} />
            <div style={{position: 'absolute', left: '50%', top: '50%', width: 3, height: 55, background: '#d46a32', transformOrigin: '50% 100%', transform: `translate(-50%, -100%) rotate(${clockSpin * 1.7}deg)`, borderRadius: 2}} />
            <div style={{position: 'absolute', left: '50%', top: '50%', width: 12, height: 12, background: '#1a233a', borderRadius: '50%', transform: 'translate(-50%, -50%)'}} />
            {/* Hour marks */}
            {[0, 90, 180, 270].map((a) => (
              <div key={a} style={{position: 'absolute', left: '50%', top: '50%', width: 2, height: 14, background: '#1a233a', transformOrigin: '50% 14px', transform: `translate(-50%, -50%) rotate(${a}deg) translateY(-76px)`, opacity: 0.9}} />
            ))}
          </div>
          <div style={{position: 'absolute', left: 340, top: 90, right: 40}}>
            <div style={{fontFamily: serif, fontSize: 22, fontWeight: 800, color: CREAM, lineHeight: 1.2}}>Price doesn’t show up</div>
            <div style={{fontFamily: serif, fontSize: 22, fontWeight: 400, color: '#cbd5e8', fontStyle: 'italic'}}>right away.</div>
            <div style={{marginTop: 12, width: 40, height: 2, background: GOLD}} />
            <div style={{marginTop: 12, fontFamily: sans, fontSize: 13, color: '#8da2c0', lineHeight: 1.5}}>It shows up hours later…<br />as <span style={{color: CORAL, fontWeight: 700}}>silent resentment.</span></div>
          </div>
        </div>

        <div style={{position: 'absolute', left: 0, top: 350, right: 0, height: 290, borderRadius: 24, background: 'linear-gradient(135deg, #1a233a 0%, #0f1a2e 100%)', border: '1px solid rgba(255,184,77,0.12)', overflow: 'hidden', padding: 28}}>
          <div style={{display: 'flex', gap: 18, alignItems: 'center'}}>
            <svg width={140} height={140} style={{flexShrink: 0}}>
              {/* Face morph: smile -> irritated */}
              <Stickman x={70} y={115} scale={0.85} pose="stand" expression={faceShift > 0.5 ? 'irritated' : 'smile'} rimLight={faceShift > 0.5 ? '#ff6b6b' : '#ffb84d'} />
              {/* Morph indicator */}
              <rect x={10} y={124} width={120} height={4} rx={2} fill="rgba(255,255,255,0.12)" />
              <rect x={10} y={124} width={faceShift * 120} height={4} rx={2} fill={faceShift > 0.5 ? '#ff6b6b' : '#ffb84d'} />
            </svg>
            <div style={{flex: 1}}>
              <div style={{fontFamily: sans, fontSize: 11, letterSpacing: 2, fontWeight: 800, color: GOLD}}>THIS ISN’T WEAKNESS</div>
              <div style={{marginTop: 8, fontFamily: serif, fontSize: 19, fontWeight: 700, color: CREAM, lineHeight: 1.25}}>Your brain is trying to protect you from a danger called:</div>
              <div style={{marginTop: 8, display: 'inline-block', background: 'rgba(255,107,107,0.14)', border: '1px solid rgba(255,107,107,0.28)', padding: '6px 14px', borderRadius: 999, fontFamily: serif, fontSize: 18, fontWeight: 800, color: CORAL, fontStyle: 'italic'}}>“people not liking you.”</div>
              <div style={{marginTop: 10, fontFamily: sans, fontSize: 12, color: '#8da2c0', opacity: resentText}}>Hours later → <span style={{color: CORAL}}>resentment</span> fills the chest.</div>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom caption */}
      <div style={{position: 'absolute', bottom: 34, left: 0, right: 0, textAlign: 'center', fontFamily: sans, fontSize: 13, color: 'rgba(255,248,231,0.72)', letterSpacing: 0.2}}>
        This isn’t a weak personality. It’s <span style={{color: '#fff', fontWeight: 700}}>belonging protection.</span>
      </div>

      <Letterbox bars="wide" />
    </AbsoluteFill>
  );
};

// Main Body Part 1: The Request (750-1150)
const MainPart1: React.FC = () => {
  const frame = useCurrentFrame();
  const local = frame;
  const shadowScale = interpolate(local, [30, 90], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.out(Easing.ease)});
  const bubbleIn = interpolate(local, [70, 110], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.out(Easing.back(1.4))});
  const shake = local > 70 && local < 150 ? Math.sin(local * 1.2) * 1.5 : 0;

  return (
    <AbsoluteFill style={{backgroundColor: BG}}>
      <div style={{position: 'absolute', inset: 0, background: `radial-gradient(900px 600px at 32% 22%, #1e2a4a 0%, ${BG} 58%), linear-gradient(180deg, #0d1528 0%, ${BG} 100%)`}} />
      {/* Door scene */}
      <div style={{position: 'absolute', left: '50%', top: '50%', width: 920, height: 640, transform: 'translate(-50%, -50%)', display: 'flex', gap: 0, borderRadius: 24, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.07)', background: 'rgba(0,0,0,0.22)', backdropFilter: 'blur(10px)'}}>
        {/* Left: door */}
        <div style={{flex: 1.1, position: 'relative', background: 'linear-gradient(180deg, #121a2e 0%, #0a0f1e 100%)', overflow: 'hidden', borderRight: '1px solid rgba(255,255,255,0.06)'}}>
          {/* Door frame */}
          <div style={{position: 'absolute', left: '50%', top: 60, width: 220, height: 420, transform: 'translateX(-50%)', background: '#0a0a0a', border: '3px solid #2a1810', borderRadius: 6, overflow: 'hidden'}}>
            <div style={{position: 'absolute', inset: 6, background: 'linear-gradient(180deg, #1e293b 0%, #0f172a 100%)', borderRadius: 3}} />
            {/* Handle */}
            <div style={{position: 'absolute', right: 28, top: 200, width: 14, height: 14, borderRadius: '50%', background: '#d4a574', border: '2px solid #8b5a2b'}} />
            <div style={{position: 'absolute', right: 32, top: 196, width: 22, height: 4, background: '#d4a574', borderRadius: 2}} />
            {/* Light behind */}
            <div style={{position: 'absolute', inset: 0, background: 'radial-gradient(200px 200px at 50% 50%, rgba(255,220,155,0.0) 0%, rgba(255,220,155,0.18) 100%)'}} />
          </div>
          {/* Floor */}
          <div style={{position: 'absolute', left: 0, right: 0, bottom: 0, height: 90, background: 'linear-gradient(180deg, #1a233a 0%, #0f1a2e 100%)', borderTop: '1px solid rgba(255,255,255,0.06)'}} />
          <div style={{position: 'absolute', left: 0, right: 0, bottom: 90, height: 1, background: 'rgba(255,220,155,0.18)', boxShadow: '0 0 12px rgba(255,220,155,0.6)'}} />

          {/* Small shadow figure behind */}
          <div
            style={{
              position: 'absolute',
              left: '50%',
              top: 120,
              width: 360,
              height: 360,
              transform: `translate(-50%, 0) scale(${shadowScale})`,
              opacity: 0.42 * shadowScale,
              background: 'radial-gradient(180px 260px at 50% 35%, #000 0%, rgba(0,0,0,0) 72%)',
              filter: 'blur(1px)',
            }}
          >
            <svg width={360} height={360} style={{position: 'absolute', inset: 0, transform: `translate(${shake}px, 0)`}}>
              {/* Large shadow behind stickman */}
              <ellipse cx={180} cy={168} rx={92} ry={88} fill="#000" opacity={0.55} />
              <rect x={112} y={168} width={136} height={140} rx={18} fill="#000" opacity={0.55} />
            </svg>
          </div>

          {/* Stickman in front */}
          <svg width={460} height={640} style={{position: 'absolute', left: 0, top: 0}}>
            <Stickman x={230} y={520} scale={1.02} pose="stand" expression="worried" rimLight="#ffb84d" />
          </svg>
          <div style={{position: 'absolute', left: 0, right: 0, bottom: 18, textAlign: 'center', fontFamily: sans, fontSize: 10, letterSpacing: 2, fontWeight: 800, color: 'rgba(255,255,255,0.38)'}}>THE MOMENT OF REQUEST</div>
        </div>
        {/* Right: thought */}
        <div style={{flex: 0.9, position: 'relative', padding: 28, background: 'rgba(255,255,255,0.02)'}}>
          <div style={{fontFamily: sans, fontSize: 11, letterSpacing: 2, fontWeight: 800, color: GOLD}}>YOUR BRAIN SEES…</div>
          <div style={{marginTop: 14, fontFamily: serif, fontSize: 30, fontWeight: 900, color: CREAM, lineHeight: 0.95}}>Not a <span style={{color: '#8da2c0'}}>task.</span></div>
          <div style={{fontFamily: serif, fontSize: 30, fontWeight: 900, color: CORAL, lineHeight: 0.95, marginTop: 4}}>A test<span style={{fontWeight: 400, color: CREAM}}> of </span>belonging.</div>
          <div style={{marginTop: 16, width: 36, height: 2, background: CORAL}} />
          <div style={{marginTop: 18, fontFamily: sans, fontSize: 13, color: '#cbd5e8', lineHeight: 1.6}}>
            It tells you: if you refuse…<br />
            <span style={{color: CORAL, fontWeight: 800, fontStyle: 'italic'}}>they’ll hate you.</span>
          </div>
          {/* Thought bubble */}
          <div
            style={{
              marginTop: 22,
              background: '#fff8e7',
              borderRadius: 18,
              borderBottomLeftRadius: 4,
              padding: '16px 18px',
              transform: `scale(${bubbleIn})`,
              transformOrigin: '0% 0%',
              opacity: bubbleIn,
              position: 'relative',
            }}
          >
            <div style={{fontFamily: sans, fontSize: 15, fontWeight: 800, color: '#1a1a1a', fontStyle: 'italic', lineHeight: 1.3}}>“If I say no, I’ll be alone.”</div>
            <div style={{position: 'absolute', left: -7, bottom: 14, width: 13, height: 13, background: '#fff8e7', transform: 'rotate(45deg)'}} />
          </div>
          <div style={{marginTop: 18, display: 'inline-flex', alignItems: 'center', gap: 8, background: 'rgba(255,107,107,0.12)', border: '1px solid rgba(255,107,107,0.22)', padding: '8px 14px', borderRadius: 999}}>
            <div style={{width: 7, height: 7, borderRadius: '50%', background: CORAL, boxShadow: `0 0 8px ${CORAL}`}} />
            <span style={{fontFamily: sans, fontSize: 11, fontWeight: 800, letterSpacing: 1, color: CORAL}}>FALSE ALARM</span>
          </div>
        </div>
      </div>
      {/* Top label */}
      <div style={{position: 'absolute', top: 34, left: 0, right: 0, textAlign: 'center'}}>
        <span style={{background: 'rgba(0,0,0,0.52)', border: '1px solid rgba(255,255,255,0.08)', padding: '7px 16px', borderRadius: 999, fontFamily: sans, fontSize: 11, letterSpacing: 2, fontWeight: 800, color: '#ffb84d'}}>1 • THE REQUEST</span>
      </div>
      <Letterbox bars="wide" />
    </AbsoluteFill>
  );
};

// Main Part 2: After yes (1150-1550)
const MainPart2: React.FC = () => {
  const frame = useCurrentFrame();
  const local = frame;
  const redProgress = interpolate(local, [20, 180], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.inOut(Easing.ease)});
  const boxBob = Math.sin(local * 0.07) * 4;
  const textIn = interpolate(local, [160, 210], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.out(Easing.back(1.2))});

  return (
    <AbsoluteFill style={{backgroundColor: BG}}>
      <div style={{position: 'absolute', inset: 0, background: `radial-gradient(900px 600px at 75% 18%, #2a1818 0%, ${BG} 60%), linear-gradient(180deg, #0f1428 0%, ${BG} 100%)`}} />

      {/* Calendar */}
      <div style={{position: 'absolute', left: 110, top: 130, width: 780, height: 560, borderRadius: 24, overflow: 'hidden', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', backdropFilter: 'blur(12px)', padding: 22}}>
        <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
          <div style={{fontFamily: sans, fontSize: 12, letterSpacing: 2, fontWeight: 800, color: '#8da2c0'}}>YOUR WEEK • AFTER “YES”</div>
          <div style={{background: 'rgba(255,107,107,0.14)', border: '1px solid rgba(255,107,107,0.22)', padding: '6px 12px', borderRadius: 999, fontFamily: sans, fontSize: 10, fontWeight: 800, letterSpacing: 1, color: CORAL}}>{Math.round(redProgress * 28)} HOURS LOST</div>
        </div>
        {/* Calendar grid 7x4 */}
        <div style={{marginTop: 18, display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 10}}>
          {Array.from({length: 28}).map((_, i) => {
            const isRed = i / 28 < redProgress;
            const isToday = i === 13;
            return (
              <div
                key={i}
                style={{
                  height: 86,
                  borderRadius: 12,
                  background: isRed ? 'linear-gradient(135deg, #ff6b6b 0%, #d33 100%)' : isToday ? '#fff8e7' : 'rgba(255,255,255,0.06)',
                  border: `1px solid ${isRed ? 'rgba(255,107,107,0.5)' : 'rgba(255,255,255,0.07)'}`,
                  display: 'flex',
                  flexDirection: 'column',
                  padding: 10,
                  position: 'relative',
                  transform: isRed ? `scale(${0.92 + Math.sin(local * 0.08 + i * 0.4) * 0.03})` : 'none',
                  boxShadow: isRed ? '0 6px 18px rgba(255,107,107,0.28)' : 'none',
                }}
              >
                <div style={{fontFamily: sans, fontSize: 10, fontWeight: 800, color: isRed ? 'white' : isToday ? '#1a1a1a' : 'rgba(255,255,255,0.45)'}}>{i + 1}</div>
                {isRed && <div style={{marginTop: 6, width: '100%', height: 3, background: 'rgba(255,255,255,0.85)', borderRadius: 2}} />}
                {isRed && <div style={{marginTop: 5, width: '68%', height: 3, background: 'rgba(255,255,255,0.55)', borderRadius: 2}} />}
                {isRed && <div style={{position: 'absolute', right: 8, bottom: 8, width: 18, height: 18, borderRadius: '50%', background: 'rgba(255,255,255,0.95)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11}}>✕</div>}
              </div>
            );
          })}
        </div>
        <div style={{marginTop: 14, display: 'flex', gap: 8, alignItems: 'center', fontFamily: sans, fontSize: 11, color: 'rgba(255,255,255,0.55)'}}>
          <div style={{width: 10, height: 10, borderRadius: 3, background: '#ff6b6b'}} /> booked • promise • “yes” you didn’t mean
        </div>
      </div>

      {/* Stickman carrying box */}
      <div style={{position: 'absolute', right: 110, top: 130, width: 760, height: 560, borderRadius: 24, overflow: 'hidden', background: 'linear-gradient(135deg, #1a233a 0%, #0f1a2e 100%)', border: '1px solid rgba(255,255,255,0.07)', padding: 0}}>
        <div style={{position: 'absolute', inset: 0, background: 'radial-gradient(500px 400px at 50% 20%, rgba(255,184,77,0.12) 0%, transparent 70%)'}} />
        <svg width={760} height={560} style={{position: 'absolute', inset: 0}}>
          {/* Floor line */}
          <line x1={60} y1={460} x2={700} y2={460} stroke="rgba(255,255,255,0.08)" strokeWidth={1} />
          {/* Dust motes */}
          <Dust frame={local} />
          {/* Figure */}
          <g transform={`translate(0, ${boxBob})`}>
            <Stickman x={380} y={445} scale={1.18} pose="carry" expression="irritated" rimLight="#ff8c42" />
          </g>
          {/* Strain lines */}
          {local > 80 && (
            <g opacity={interpolate(local, [80, 120], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'})}>
              <path d="M 520 310 l 12 -14" stroke="#ff6b6b" strokeWidth={2} strokeLinecap="round" opacity={0.9} />
              <path d="M 540 300 l 14 -12" stroke="#ff6b6b" strokeWidth={2} strokeLinecap="round" opacity={0.9} />
              <path d="M 500 300 l -10 -14" stroke="#ff6b6b" strokeWidth={2} strokeLinecap="round" opacity={0.8} />
            </g>
          )}
        </svg>
        {/* 3D box inset */}
        <div style={{position: 'absolute', bottom: 14, right: 14, width: 160, height: 160, borderRadius: 12, overflow: 'hidden', border: '1px solid rgba(255,184,77,0.15)', background: 'rgba(0,0,0,0.28)'}}>
          <ThreeCanvas width={160} height={160} camera={{position: [2.6, 1.4, 2.6], fov: 32}}>
            <ambientLight intensity={0.65} />
            <directionalLight position={[4, 6, 4]} intensity={1.1} color="#ffe9c2" />
            <directionalLight position={[-3, 2, -3]} intensity={0.35} color="#6b8cff" />
            <PromiseBox3D />
            <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.7, 0]}>
              <planeGeometry args={[6, 6]} />
              <meshStandardMaterial color="#0f1a2e" />
            </mesh>
          </ThreeCanvas>
          <div style={{position: 'absolute', bottom: 4, left: 0, right: 0, textAlign: 'center', fontFamily: sans, fontSize: 8, letterSpacing: 1.5, color: 'rgba(255,255,255,0.5)', fontWeight: 700}}>HEAVY TO CARRY</div>
        </div>
        <div style={{position: 'absolute', top: 16, left: 18, background: 'rgba(0,0,0,0.45)', border: '1px solid rgba(255,255,255,0.08)', padding: '6px 12px', borderRadius: 999, fontFamily: sans, fontSize: 10, letterSpacing: 1.5, fontWeight: 800, color: '#ffb84d'}}>2 • AFTER YOU SAY YES</div>
      </div>

      {/* Bottom quote */}
      <div
        style={{
          position: 'absolute',
          left: '50%',
          bottom: 64,
          transform: 'translateX(-50%)',
          background: '#fff8e7',
          padding: '14px 28px',
          borderRadius: 18,
          borderBottomLeftRadius: 4,
          boxShadow: '0 10px 30px rgba(0,0,0,0.45)',
          opacity: textIn,
          scale: `${textIn}`,
        }}
      >
        <div style={{fontFamily: serif, fontSize: 20, fontWeight: 800, fontStyle: 'italic', color: '#1a1a1a'}}>“Why did I agree?”</div>
        <div style={{position: 'absolute', left: -8, bottom: 12, width: 14, height: 14, background: '#fff8e7', transform: 'rotate(45deg)'}} />
        <div style={{position: 'absolute', top: -8, right: 18, background: '#ff6b6b', color: 'white', fontFamily: sans, fontSize: 9, fontWeight: 800, letterSpacing: 1, padding: '3px 8px', borderRadius: 999}}>+ small resentment, every hour</div>
      </div>

      <Letterbox bars="wide" />
    </AbsoluteFill>
  );
};

// Main Part 3: Solution (1550-1950)
const MainPart3: React.FC = () => {
  const frame = useCurrentFrame();
  const local = frame;
  const handUp = interpolate(local, [20, 70], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.out(Easing.back(1.1))});
  const breath = Math.sin(local * 0.07) * 3 * handUp;
  const clockGreen = interpolate(local, [120, 200], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
  const sentenceIn = interpolate(local, [60, 110], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.out(Easing.back(1.2))});
  const trapBreak = interpolate(local, [180, 250], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});

  return (
    <AbsoluteFill style={{backgroundColor: BG}}>
      <div style={{position: 'absolute', inset: 0, background: `radial-gradient(900px 600px at 50% 18%, #1a2e1e 0%, ${BG} 62%), linear-gradient(180deg, #0d1a15 0%, ${BG} 100%)`}} />
      {/* Soft glow */}
      <div style={{position: 'absolute', left: '50%', top: 120, width: 1100, height: 700, transform: 'translateX(-50%)', background: 'radial-gradient(600px 400px at 50% 30%, rgba(42,180,110,0.10) 0%, transparent 70%)'}} />

      {/* Central card */}
      <div style={{position: 'absolute', left: '50%', top: 140, width: 1060, height: 560, transform: 'translateX(-50%)', borderRadius: 28, overflow: 'hidden', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', backdropFilter: 'blur(14px)', display: 'flex'}}>
        {/* Left: figure */}
        <div style={{flex: 1, position: 'relative', background: 'linear-gradient(180deg, rgba(255,255,255,0.03) 0%, rgba(0,0,0,0.15) 100%)', overflow: 'hidden'}}>
          <svg width={530} height={560} style={{position: 'absolute', inset: 0}}>
            <Dust frame={local} />
            {/* Figure with hand up, breathing */}
            <g transform={`translate(0, ${breath})`}>
              <Stickman x={265} y={440} scale={1.22} pose="handUp" expression={local > 120 ? 'relieved' : 'thinking'} rimLight="#3fb950" opacity={0.98} />
            </g>
            {/* Hand raise indicator */}
            <g opacity={handUp} transform={`translate(300, 220) scale(${handUp})`}>
              <circle r={22} fill="rgba(63,185,80,0.18)" stroke="rgba(63,185,80,0.5)" strokeWidth={1.2} />
              <text textAnchor="middle" dy={5} fontFamily={sans} fontSize={14} fontWeight={800} fill="#3fb950">✋</text>
            </g>
            {/* Breath glow */}
            <ellipse cx={265} cy={360} rx={34 + Math.sin(local * 0.07) * 6} ry={22 + Math.sin(local * 0.07) * 4} fill="none" stroke="rgba(63,185,80,0.22)" strokeWidth={1.2} opacity={0.7 * handUp} />
          </svg>
          {/* Clock */}
          <div
            style={{
              position: 'absolute',
              bottom: 18,
              left: 18,
              right: 18,
              height: 64,
              borderRadius: 14,
              background: clockGreen > 0.5 ? 'linear-gradient(135deg, #3fb950 0%, #2a7a3a 100%)' : 'linear-gradient(135deg, #ff6b6b 0%, #c33 100%)',
              border: '1px solid rgba(255,255,255,0.14)',
              display: 'flex',
              alignItems: 'center',
              padding: '0 16px',
              gap: 12,
              transform: `scale(${0.96 + clockGreen * 0.04})`,
              transition: 'background 0.3s',
            }}
          >
            <div style={{width: 40, height: 40, borderRadius: '50%', background: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0}}>
              <div style={{width: 2, height: 14, background: clockGreen > 0.5 ? '#2a7a3a' : '#c33', transformOrigin: '50% 100%', transform: `rotate(${clockGreen > 0.5 ? 0 : 45}deg) translateY(-7px)`, borderRadius: 2}} />
              <div style={{position: 'absolute', width: 6, height: 6, background: '#1a1a1a', borderRadius: '50%'}} />
            </div>
            <div>
              <div style={{fontFamily: sans, fontSize: 10, fontWeight: 800, letterSpacing: 1.5, color: 'white', opacity: 0.9}}>{clockGreen > 0.5 ? 'ONE SECOND • GREEN' : 'ONE SECOND • RED'}</div>
              <div style={{fontFamily: sans, fontSize: 13, fontWeight: 800, color: 'white'}}>{clockGreen > 0.5 ? 'you gave yourself time' : 'you answered instantly'}</div>
            </div>
            <div style={{marginLeft: 'auto', width: 42, height: 26, borderRadius: 999, background: 'rgba(0,0,0,0.22)', padding: 3, display: 'flex', alignItems: 'center'}}>
              <div style={{width: 20, height: 20, borderRadius: '50%', background: 'white', transform: `translateX(${clockGreen * 16}px)`, transition: 'transform 0.4s', boxShadow: '0 2px 8px rgba(0,0,0,0.3)'}} />
            </div>
          </div>
          <div style={{position: 'absolute', top: 14, left: 14, background: 'rgba(0,0,0,0.45)', border: '1px solid rgba(255,255,255,0.08)', padding: '6px 12px', borderRadius: 999, fontFamily: sans, fontSize: 10, letterSpacing: 1.5, fontWeight: 800, color: '#3fb950'}}>3 • THE SOLUTION</div>
        </div>
        {/* Right: sentence */}
        <div style={{flex: 1, padding: 30, display: 'flex', flexDirection: 'column', justifyContent: 'center', background: 'rgba(255,255,255,0.015)'}}>
          <div style={{fontFamily: sans, fontSize: 11, letterSpacing: 2, fontWeight: 800, color: GOLD}}>NOT A HARSHER PERSON</div>
          <div style={{marginTop: 10, fontFamily: serif, fontSize: 28, fontWeight: 800, color: CREAM, lineHeight: 1.15}}>The solution is one<br />small sentence:</div>
          <div
            style={{
              marginTop: 18,
              background: '#fff8e7',
              borderRadius: 16,
              borderBottomLeftRadius: 4,
              padding: '18px 20px',
              transform: `scale(${sentenceIn})`,
              transformOrigin: '0% 0%',
              opacity: sentenceIn,
              position: 'relative',
              boxShadow: '0 12px 30px rgba(0,0,0,0.35)',
            }}
          >
            <div style={{fontFamily: serif, fontSize: 20, fontWeight: 800, fontStyle: 'italic', color: '#1a1a1a', lineHeight: 1.35}}>“Let me check…<br />and I’ll get back to you.”</div>
            <div style={{position: 'absolute', left: -7, bottom: 14, width: 13, height: 13, background: '#fff8e7', transform: 'rotate(45deg)'}} />
            <div style={{position: 'absolute', top: -10, right: 14, background: '#3fb950', color: 'white', fontFamily: sans, fontSize: 9, fontWeight: 800, letterSpacing: 1, padding: '4px 9px', borderRadius: 999}}>BREAKS THE TRAP ✓</div>
          </div>
          <div style={{marginTop: 18, display: 'flex', alignItems: 'center', gap: 10}}>
            <div style={{width: 8, height: 8, borderRadius: '50%', background: '#3fb950', boxShadow: '0 0 10px #3fb950', opacity: trapBreak}} />
            <div style={{fontFamily: sans, fontSize: 12, fontWeight: 700, color: '#cbd5e8', opacity: trapBreak}}>It gives you <span style={{color: '#3fb950'}}>one second</span> before “yes.”</div>
          </div>
          {/* Chain breaking visual */}
          <div style={{marginTop: 16, display: 'flex', gap: 6, alignItems: 'center', opacity: trapBreak}}>
            {[0, 1, 2, 3].map((i) => (
              <div key={i} style={{flex: 1, height: 4, borderRadius: 2, background: i === 2 ? 'rgba(255,255,255,0.08)' : '#3fb950', position: 'relative'}}>
                {i === 2 && <div style={{position: 'absolute', left: '50%', top: '50%', width: 16, height: 16, background: '#1a1a1a', border: '2px solid #ff6b6b', borderRadius: '50%', transform: 'translate(-50%, -50%)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 8, color: '#ff6b6b'}}>✕</div>}
              </div>
            ))}
            <span style={{fontFamily: sans, fontSize: 10, fontWeight: 800, letterSpacing: 1, color: '#3fb950', marginLeft: 6}}>TRAP BROKEN</span>
          </div>
        </div>
      </div>

      {/* 3D inset */}
      <div style={{position: 'absolute', left: '50%', bottom: 36, transform: 'translateX(-50%)', width: 260, height: 96, borderRadius: 12, overflow: 'hidden', border: '1px solid rgba(63,185,80,0.18)', background: 'rgba(0,0,0,0.32)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', padding: 10, gap: 12}}>
        <div style={{width: 74, height: 74, borderRadius: 10, overflow: 'hidden', flexShrink: 0, border: '1px solid rgba(255,255,255,0.08)'}}>
          <ThreeCanvas width={74} height={74} camera={{position: [0, 0, 3.2], fov: 42}}>
            <ambientLight intensity={0.7} />
            <directionalLight position={[4, 4, 4]} intensity={1} color="#ffe9c2" />
            <RotatingCube offset={120} />
          </ThreeCanvas>
        </div>
        <div>
          <div style={{fontFamily: sans, fontSize: 10, letterSpacing: 1.5, fontWeight: 800, color: '#3fb950'}}>ONE SENTENCE</div>
          <div style={{fontFamily: sans, fontSize: 12, fontWeight: 700, color: CREAM, marginTop: 2}}>“Let me check…”</div>
          <div style={{fontFamily: sans, fontSize: 11, color: '#8da2c0'}}>Buys you the second you need.</div>
        </div>
      </div>

      <Letterbox bars="wide" />
    </AbsoluteFill>
  );
};

// Payoff 1950-2550 (20s)
const Payoff: React.FC = () => {
  const frame = useCurrentFrame();
  const local = frame;
  const doorOpen = interpolate(local, [40, 160], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.inOut(Easing.ease)});
  const lightIntensity = interpolate(local, [80, 180], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
  const noToDoor = interpolate(local, [220, 320], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.out(Easing.back(1.1))});
  const textPulse = 1 + Math.sin(local * 0.06) * 0.015;

  return (
    <AbsoluteFill style={{backgroundColor: BG}}>
      <div style={{position: 'absolute', inset: 0, background: `radial-gradient(1000px 700px at 58% 45%, #2a1f0a 0%, ${BG} 58%), linear-gradient(180deg, #0d1528 0%, ${BG} 100%)`}} />
      {/* Light rays from door */}
      <div
        style={{
          position: 'absolute',
          left: '50%',
          top: 220,
          width: 900,
          height: 600,
          transform: 'translateX(-50%)',
          background: `radial-gradient(600px 400px at 50% 40%, rgba(255,220,155,${0.18 * lightIntensity}) 0%, transparent 72%)`,
          opacity: lightIntensity,
        }}
      />
      {/* God rays */}
      <svg width={1920} height={1080} style={{position: 'absolute', inset: 0, opacity: 0.35 * lightIntensity}}>
        <g stroke="rgba(255,220,155,0.18)" strokeWidth={1.2}>
          <line x1={960} y1={380} x2={720} y2={900} />
          <line x1={960} y1={380} x2={860} y2={900} />
          <line x1={960} y1={380} x2={1020} y2={900} />
          <line x1={960} y1={380} x2={1180} y2={900} />
        </g>
      </svg>

      {/* Main door card */}
      <div style={{position: 'absolute', left: '50%', top: 130, width: 1060, height: 580, transform: 'translateX(-50%)', borderRadius: 28, overflow: 'hidden', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', backdropFilter: 'blur(14px)', display: 'flex'}}>
        {/* Left: door scene */}
        <div style={{flex: 1.05, position: 'relative', background: 'linear-gradient(180deg, #0f172a 0%, #0a0f1e 100%)', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center'}}>
          {/* 3D door */}
          <div style={{width: 420, height: 420, borderRadius: 18, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.07)', background: 'rgba(0,0,0,0.2)'}}>
            <ThreeCanvas width={420} height={420} camera={{position: [0, 0.2, 4.8], fov: 38}}>
              <ambientLight intensity={0.62} />
              <directionalLight position={[5, 6, 5]} intensity={1.05} color="#ffe9c2" />
              <directionalLight position={[-4, 3, -2]} intensity={0.32} color="#6b8cff" />
              {/* Use global frame for door open: already via FloatingDoor's interpolation based on global frame */}
              <FloatingDoor />
              <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -1.35, 0]}>
                <planeGeometry args={[8, 8]} />
                <meshStandardMaterial color="#0f1a2e" roughness={0.95} />
              </mesh>
            </ThreeCanvas>
          </div>
          {/* Stickman opening door */}
          <svg width={530} height={580} style={{position: 'absolute', inset: 0, pointerEvents: 'none'}}>
            <g opacity={0.95} transform={`translate(${doorOpen * 14}, 0)`}>
              <Stickman x={220} y={470} scale={1.06} pose={doorOpen > 0.5 ? 'openDoor' : 'stand'} expression={doorOpen > 0.4 ? 'relieved' : 'thinking'} rimLight="#ffb84d" />
            </g>
          </svg>
          <div style={{position: 'absolute', bottom: 14, left: 14, background: 'rgba(0,0,0,0.48)', border: '1px solid rgba(255,255,255,0.08)', padding: '6px 12px', borderRadius: 999, fontFamily: sans, fontSize: 10, letterSpacing: 1.5, fontWeight: 800, color: '#ffb84d'}}>PAYOFF • THE DOOR</div>
        </div>
        {/* Right: text */}
        <div style={{flex: 0.95, padding: 32, display: 'flex', flexDirection: 'column', justifyContent: 'center'}}>
          <div style={{fontFamily: sans, fontSize: 11, letterSpacing: 2, fontWeight: 800, color: GOLD}}>BOUNDARIES</div>
          <div style={{marginTop: 12, fontFamily: serif, fontSize: 26, fontWeight: 800, color: CREAM, lineHeight: 1.2}}>
            Are <span style={{color: CORAL}}>not a wall</span>
            <br />
            that keeps people out.
          </div>
          <div style={{marginTop: 14, display: 'inline-flex', alignSelf: 'flex-start', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', padding: '10px 16px', borderRadius: 12}}>
            <div style={{fontFamily: serif, fontSize: 17, fontWeight: 700, color: CREAM, lineHeight: 1.3}}>
              Boundaries are a <span style={{color: GOLD, fontStyle: 'italic'}}>door…</span>
              <br />
              <span style={{fontSize: 14, fontWeight: 600, color: '#cbd5e8'}}>with the handle on <span style={{color: GOLD}}>your side.</span></span>
            </div>
          </div>
          {/* No -> door morph */}
          <div style={{marginTop: 20, borderRadius: 14, background: '#fff8e7', padding: '16px 18px', position: 'relative', transform: `scale(${textPulse})`, border: '1px solid rgba(0,0,0,0.06)'}}>
            <div style={{fontFamily: sans, fontSize: 10, letterSpacing: 1.5, fontWeight: 800, color: '#8da2c0'}}>THE PERSON WHO DRAINS YOU MOST…</div>
            <div style={{marginTop: 6, fontFamily: serif, fontSize: 15, color: '#1a1a1a', lineHeight: 1.45}}>
              isn’t a person.
              <br />
              It’s a <span style={{background: '#1a1a1a', color: 'white', padding: '1px 8px', borderRadius: 6, fontWeight: 800}}>“yes”</span> you said when you wanted to say <span style={{background: '#fff', border: '1.5px solid #1a1a1a', color: '#1a1a1a', padding: '1px 8px', borderRadius: 6, fontWeight: 800}}>“no.”</span>
            </div>
            {/* No -> door icon */}
            <div
              style={{
                position: 'absolute',
                right: 16,
                top: 14,
                width: 64,
                height: 64,
                borderRadius: 12,
                background: noToDoor > 0 ? '#0a0a0a' : '#fff',
                border: `2px solid ${noToDoor > 0 ? '#ffb84d' : '#1a1a1a'}`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transform: `scale(${0.7 + noToDoor * 0.3}) rotate(${noToDoor * 6}deg)`,
                opacity: 0.95,
              }}
            >
              <div style={{textAlign: 'center'}}>
                <div style={{fontFamily: sans, fontSize: 18, fontWeight: 900, color: noToDoor > 0 ? '#ffb84d' : '#1a1a1a', lineHeight: 1}}>{noToDoor > 0.5 ? '🚪' : 'NO'}</div>
                {noToDoor > 0.5 && <div style={{fontFamily: sans, fontSize: 7, fontWeight: 800, letterSpacing: 1, color: '#ffb84d', marginTop: 2}}>NOT A SWORD</div>}
              </div>
            </div>
          </div>
          <div style={{marginTop: 14, fontFamily: sans, fontSize: 11, color: '#8da2c0', fontStyle: 'italic'}}>“no” turns into a small, elegant door — not a sword.</div>
        </div>
      </div>

      <Letterbox bars={doorOpen > 0.6 ? 'scope' : 'wide'} />
    </AbsoluteFill>
  );
};

// Outro 2550-3000 (15s)
const Outro: React.FC = () => {
  const frame = useCurrentFrame();
  const local = frame;
  const commentIn = interpolate(local, [14, 44], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.out(Easing.back(1.1))});
  const subIn = interpolate(local, [60, 100], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.out(Easing.back(1.1))});
  const purchaseIn = interpolate(local, [180, 220], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
  const pulse = 1 + Math.sin(local * 0.09) * 0.03;

  return (
    <AbsoluteFill style={{backgroundColor: BG}}>
      <div style={{position: 'absolute', inset: 0, background: `radial-gradient(900px 600px at 50% 22%, #1e2740 0%, ${BG} 62%), linear-gradient(180deg, #0f1a2e 0%, ${BG} 100%)`}} />
      <svg width={1920} height={1080} style={{position: 'absolute', inset: 0}}>
        <Dust frame={local} />
      </svg>

      {/* Center composition */}
      <div style={{position: 'absolute', left: '50%', top: 110, width: 1060, transform: 'translateX(-50%)'}}>
        {/* Question card */}
        <div style={{borderRadius: 24, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', backdropFilter: 'blur(12px)', padding: 26, display: 'flex', gap: 18, alignItems: 'center'}}>
          <svg width={140} height={140} style={{flexShrink: 0}}>
            <Stickman x={70} y={115} scale={0.92} pose="type" expression="thinking" rimLight="#ffb84d" />
          </svg>
          <div style={{flex: 1}}>
            <div style={{display: 'inline-block', background: 'rgba(255,184,77,0.14)', border: '1px solid rgba(255,184,77,0.22)', padding: '5px 12px', borderRadius: 999, fontFamily: sans, fontSize: 10, letterSpacing: 1.5, fontWeight: 800, color: GOLD}}>YOUR TURN • COMMENT BELOW</div>
            <div style={{marginTop: 10, fontFamily: serif, fontSize: 28, fontWeight: 900, fontStyle: 'italic', color: CREAM, lineHeight: 1.15}}>When was the last time you said “yes”…</div>
            <div style={{fontFamily: serif, fontSize: 28, fontWeight: 400, color: '#cbd5e8', lineHeight: 1.15}}>when you wanted to say “no”?</div>
          </div>
          {/* Comment bubble mock */}
          <div
            style={{
              width: 320,
              background: '#fff8e7',
              borderRadius: 14,
              borderBottomRightRadius: 4,
              padding: '14px 16px',
              transform: `scale(${commentIn})`,
              transformOrigin: '0% 50%',
              opacity: commentIn,
              position: 'relative',
              boxShadow: '0 10px 30px rgba(0,0,0,0.35)',
            }}
          >
            <div style={{display: 'flex', gap: 8, alignItems: 'center'}}>
              <div style={{width: 28, height: 28, borderRadius: '50%', background: '#1a1a1a', flexShrink: 0}} />
              <div style={{flex: 1, height: 8, borderRadius: 4, background: '#1a1a1a', opacity: 0.85, width: '60%'}} />
            </div>
            <div style={{marginTop: 10, height: 7, borderRadius: 4, background: 'rgba(0,0,0,0.12)', width: '92%'}} />
            <div style={{marginTop: 6, height: 7, borderRadius: 4, background: 'rgba(0,0,0,0.08)', width: '78%'}} />
            <div style={{marginTop: 10, display: 'flex', gap: 6}}>
              <div style={{flex: 1, height: 26, borderRadius: 999, background: '#1a1a1a', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontFamily: sans, fontSize: 10, fontWeight: 800}}>Post comment →</div>
            </div>
            <div style={{position: 'absolute', right: -7, bottom: 14, width: 13, height: 13, background: '#fff8e7', transform: 'rotate(45deg)'}} />
          </div>
        </div>

        {/* Second row: subscribe + teaser */}
        <div style={{marginTop: 16, display: 'flex', gap: 16}}>
          <div style={{flex: 1, borderRadius: 20, background: 'linear-gradient(135deg, #1a233a 0%, #0f1a2e 100%)', border: '1px solid rgba(255,255,255,0.07)', padding: 22, display: 'flex', alignItems: 'center', gap: 16}}>
            <div
              style={{
                background: '#fff8e7',
                color: '#1a1a1a',
                padding: '12px 22px',
                borderRadius: 999,
                fontFamily: sans,
                fontSize: 15,
                fontWeight: 900,
                letterSpacing: 0.5,
                transform: `scale(${subIn * pulse})`,
                transformOrigin: '0% 50%',
                opacity: subIn,
                boxShadow: '0 8px 20px rgba(0,0,0,0.35)',
              }}
            >
              Subscribe
            </div>
            <div style={{flex: 1}}>
              <div style={{fontFamily: sans, fontSize: 11, letterSpacing: 1.5, fontWeight: 800, color: '#8da2c0'}}>NEXT EPISODE</div>
              <div style={{fontFamily: serif, fontSize: 16, fontWeight: 800, color: CREAM, marginTop: 2}}>Why do you regret purchases?</div>
              <div style={{fontFamily: sans, fontSize: 12, color: '#8da2c0', marginTop: 2}}>Another trap is coming. Don’t miss it.</div>
            </div>
          </div>

          {/* Teaser phone + card */}
          <div
            style={{
              width: 340,
              borderRadius: 20,
              background: 'rgba(0,0,0,0.28)',
              border: '1px solid rgba(255,255,255,0.07)',
              padding: 16,
              display: 'flex',
              alignItems: 'center',
              gap: 14,
              opacity: purchaseIn,
              transform: `translateY(${interpolate(purchaseIn, [0, 1], [12, 0])}px)`,
            }}
          >
            <div style={{width: 86, height: 120, borderRadius: 12, background: '#fff8e7', border: '2px solid #1a1a1a', position: 'relative', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center'}}>
              <div style={{width: 64, height: 44, borderRadius: 8, background: 'linear-gradient(135deg, #2a5bd7 0%, #6b8cff 100%)', border: '1px solid rgba(0,0,0,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontFamily: sans, fontSize: 10, fontWeight: 800}}>$ ••••</div>
              <div style={{position: 'absolute', top: -8, right: -8, width: 28, height: 28, borderRadius: '50%', background: '#ff6b6b', border: '2px solid white', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 900, fontSize: 16}}>?</div>
            </div>
            <div style={{flex: 1}}>
              <div style={{width: 18, height: 18, borderRadius: '50%', background: '#ffb84d', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10}}>🛒</div>
              <div style={{marginTop: 6, fontFamily: sans, fontSize: 12, fontWeight: 800, color: CREAM}}>The purchase trap</div>
              <div style={{fontFamily: sans, fontSize: 11, color: '#8da2c0'}}>Why the cart feels good… and regret feels heavier.</div>
            </div>
          </div>
        </div>

        {/* Bottom cast line */}
        <div style={{marginTop: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, opacity: 0.9}}>
          <div style={{display: 'flex', gap: 6}}>
            {[0, 1, 2, 3].map((i) => (
              <div key={i} style={{width: 28, height: 28, borderRadius: '50%', background: ['#ff8c42', '#3fb950', '#6b8cff', '#ffb84d'][i], border: '2px solid rgba(255,255,255,0.9)', marginLeft: i === 0 ? 0 : -8}} />
            ))}
          </div>
          <span style={{fontFamily: sans, fontSize: 11, color: 'rgba(255,255,255,0.6)'}}>Small Traps • A series about the tiny choices that run your life</span>
        </div>
      </div>

      {/* End screen subtle 3D */}
      <div style={{position: 'absolute', right: 24, top: 560, width: 180, height: 180, borderRadius: 16, overflow: 'hidden', opacity: 0.72, border: '1px solid rgba(255,255,255,0.06)'}}>
        <ThreeCanvas width={180} height={180} camera={{position: [0, 0, 3.8], fov: 36}}>
          <ambientLight intensity={0.65} />
          <directionalLight position={[4, 4, 4]} intensity={1} color="#ffe9c2" />
          <RotatingCube offset={200} />
        </ThreeCanvas>
      </div>

      <Letterbox bars="wide" />
    </AbsoluteFill>
  );
};

export const MainComposition: React.FC = () => {
  // Global 3D background - subtle persistent cube to satisfy visual richness, but transparent so 2D shows
  // We keep a full-screen ThreeCanvas behind everything at low opacity, but we also have per-scene insets
  // To keep determinism, this background cube rotates continuously via global frame

  return (
    <AbsoluteFill style={{backgroundColor: BG}}>
      {/* Persistent subtle 3D background - very low opacity, always visible, deterministic */}
      <ThreeCanvas width={1920} height={1080} camera={{position: [0, 0, 6], fov: 45}} style={{position: 'absolute', inset: 0, opacity: 0.14}}>
        <ambientLight intensity={0.55} />
        <directionalLight position={[5, 5, 5]} intensity={0.9} color="#ffe9c2" />
        <directionalLight position={[-4, 2, -3]} intensity={0.28} color="#6b8cff" />
        <RotatingCube />
        <FloatingDoor />
      </ThreeCanvas>

      {/* Story sequences - each outside ThreeCanvas, so no layout="none" needed */}
      <Sequence from={0} durationInFrames={300}>
        <Hook />
      </Sequence>
      <Sequence from={300} durationInFrames={450}>
        <Setup />
      </Sequence>
      <Sequence from={750} durationInFrames={400}>
        <MainPart1 />
      </Sequence>
      <Sequence from={1150} durationInFrames={400}>
        <MainPart2 />
      </Sequence>
      <Sequence from={1550} durationInFrames={400}>
        <MainPart3 />
      </Sequence>
      <Sequence from={1950} durationInFrames={600}>
        <Payoff />
      </Sequence>
      <Sequence from={2550} durationInFrames={450}>
        <Outro />
      </Sequence>

      {/* Top progress bar */}
      <ProgressBar />

      {/* Watermark */}
      <div style={{position: 'absolute', top: 18, right: 24, fontFamily: sans, fontSize: 10, letterSpacing: 2, fontWeight: 800, color: 'rgba(255,255,255,0.38)', background: 'rgba(0,0,0,0.45)', padding: '6px 12px', borderRadius: 999, border: '1px solid rgba(255,255,255,0.08)'}}>
        SMALL TRAPS
      </div>
    </AbsoluteFill>
  );
};

const ProgressBar: React.FC = () => {
  const frame = useCurrentFrame();
  const progress = frame / 3000;
  return (
    <div style={{position: 'absolute', bottom: 0, left: 0, right: 0, height: 3, background: 'rgba(255,255,255,0.08)', zIndex: 20}}>
      <div style={{width: `${progress * 100}%`, height: '100%', background: 'linear-gradient(90deg, #f2c21a 0%, #ff8c42 100%)', boxShadow: '0 0 10px rgba(242,194,26,0.6)'}} />
    </div>
  );
};
