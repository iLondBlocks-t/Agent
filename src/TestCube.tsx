import React from 'react';
import {AbsoluteFill, useCurrentFrame, interpolate} from 'remotion';
import {ThreeCanvas} from '@remotion/three';
import * as THREE from 'three';

// Deterministic rotating cube - fulfills Essentiel rule 6
// No useFrame, only useCurrentFrame, with explicit width/height, proper lighting

const RotatingCube: React.FC = () => {
  const frame = useCurrentFrame();
  // 2 seconds per full rotation = 60 frames
  const rotation = (frame / 60) * Math.PI * 2;
  // Slight tilt for visibility
  return (
    <mesh rotation={[0.5, rotation, 0.2]} position={[0, 0, 0]}>
      <boxGeometry args={[2, 2, 2]} />
      <meshStandardMaterial color="#f2c21a" roughness={0.4} metalness={0.1} />
    </mesh>
  );
};

const FloatingLight: React.FC = () => {
  const frame = useCurrentFrame();
  const y = interpolate(frame, [0, 150], [-2, 2], {extrapolateRight: 'clamp'});
  // Subtle bobbing light - deterministic
  return (
    <mesh position={[2, y, 1]}>
      <sphereGeometry args={[0.2, 16, 16]} />
      <meshStandardMaterial color="#ffffff" emissive="#fff2a8" emissiveIntensity={2} />
    </mesh>
  );
};

export const TestCubeScene: React.FC = () => {
  return (
    <AbsoluteFill style={{backgroundColor: '#0a0f1e'}}>
      {/* All 3D content wrapped in ThreeCanvas with explicit width and height */}
      <ThreeCanvas
        width={1920}
        height={1080}
        camera={{position: [0, 0, 6], fov: 45}}
        style={{backgroundColor: 'transparent'}}
      >
        {/* Proper lighting: ambient + directional */}
        <ambientLight intensity={0.7} />
        <directionalLight position={[5, 5, 5]} intensity={1.2} color="#ffe9c2" />
        <directionalLight position={[-3, 2, -2]} intensity={0.4} color="#6b8cff" />
        <RotatingCube />
        <FloatingLight />
        {/* Ground plane for reference */}
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -2, 0]}>
          <planeGeometry args={[10, 10]} />
          <meshStandardMaterial color="#1a233a" roughness={0.8} />
        </mesh>
      </ThreeCanvas>

      {/* 2D overlay - deterministic text */}
      <div
        style={{
          position: 'absolute',
          bottom: 80,
          left: 0,
          right: 0,
          textAlign: 'center',
          color: '#fff8e7',
          fontFamily: 'Inter, system-ui, sans-serif',
          fontSize: 28,
          letterSpacing: 2,
          textTransform: 'uppercase',
          opacity: 0.9,
        }}
      >
        Deterministic Test — Rotating Cube • useCurrentFrame() only • No flicker
      </div>
      <div
        style={{
          position: 'absolute',
          top: 40,
          left: 40,
          color: '#8da2c0',
          fontFamily: 'monospace',
          fontSize: 14,
        }}
      >
        ThreeCanvas width={1920} height={1080} • ambientLight + directionalLight • camera [0,0,6]
      </div>
    </AbsoluteFill>
  );
};
