import React from 'react';
import {useCurrentFrame, interpolate} from 'remotion';

// All 3D uses useCurrentFrame only - no useFrame
// Each element is deterministic

export const RotatingCube: React.FC<{offset?: number}> = ({offset = 0}) => {
  const frame = useCurrentFrame();
  const rotY = ((frame + offset) / 60) * Math.PI * 2;
  const rotX = 0.35 + Math.sin((frame + offset) * 0.01) * 0.12;
  return (
    <mesh rotation={[rotX, rotY, 0.15]} position={[0, 0.2, 0]}>
      <boxGeometry args={[1.6, 1.6, 1.6]} />
      <meshStandardMaterial color="#f2c21a" emissive="#ff8c42" emissiveIntensity={0.08} roughness={0.35} metalness={0.15} />
    </mesh>
  );
};

export const FloatingDoor: React.FC = () => {
  const frame = useCurrentFrame();
  // Door opening animation: closed 0deg -> open 90deg around Y
  // Global frame drives it: opens around 1950-2100 (payoff)
  // We'll make it continuously subtle: oscillate a bit before payoff, then open
  const open = interpolate(frame, [1950, 2150], [0, Math.PI * 0.52], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  // Add subtle hover
  const hover = Math.sin(frame * 0.02) * 0.08;
  return (
    <group position={[0, hover, 0]}>
      {/* Door frame */}
      <mesh position={[0, 0, 0]}>
        <boxGeometry args={[1.4, 2.2, 0.08]} />
        <meshStandardMaterial color="#2a1810" roughness={0.9} />
      </mesh>
      {/* Door leaf - pivots on left edge */}
      <group position={[-0.6, 0, 0.06]} rotation={[0, -open, 0]}>
        <mesh position={[0.6, 0, 0]}>
          <boxGeometry args={[1.18, 2.0, 0.06]} />
          <meshStandardMaterial color="#d4a574" roughness={0.6} />
        </mesh>
        {/* Handle */}
        <mesh position={[0.95, -0.05, 0.07]}>
          <sphereGeometry args={[0.07, 12, 12]} />
          <meshStandardMaterial color="#f2c21a" metalness={0.8} roughness={0.2} />
        </mesh>
        {/* Light from behind when open */}
        <mesh position={[0.6, 0, -0.3]}>
          <planeGeometry args={[1.1, 1.9]} />
          <meshStandardMaterial color="#fff2a8" emissive="#ffe9a0" emissiveIntensity={open * 1.2} transparent opacity={open * 0.9} />
        </mesh>
      </group>
      {/* Light spill on floor */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0.4, -1.15, 0.2]}>
        <planeGeometry args={[2.2, 1.4]} />
        <meshStandardMaterial color="#ffe9a0" emissive="#ffe9a0" emissiveIntensity={open * 0.6} transparent opacity={open * 0.35} />
      </mesh>
    </group>
  );
};

export const PromiseBox3D: React.FC = () => {
  const frame = useCurrentFrame();
  const bob = Math.sin(frame * 0.04) * 0.07;
  const tilt = Math.sin(frame * 0.015) * 0.08;
  return (
    <group position={[0, bob, 0]} rotation={[tilt, 0.3, tilt * 0.5]}>
      <mesh>
        <boxGeometry args={[1.8, 1.0, 1.0]} />
        <meshStandardMaterial color="#2a1810" roughness={0.7} />
      </mesh>
      {/* Label */}
      <mesh position={[0, 0, 0.51]}>
        <planeGeometry args={[1.4, 0.45]} />
        <meshStandardMaterial color="#ff8c42" emissive="#ff6b2b" emissiveIntensity={0.2} />
      </mesh>
    </group>
  );
};
