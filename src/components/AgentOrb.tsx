import { motion } from 'framer-motion';
import type { AgentRole } from '@/types';

const ROLE_GRADIENT: Record<AgentRole, string> = {
  planner: 'from-violet-500 to-blue-500',
  coder: 'from-blue-500 to-cyan-400',
  reviewer: 'from-amber-400 to-orange-500',
  devops: 'from-emerald-400 to-teal-500',
  researcher: 'from-cyan-400 to-sky-500',
  designer: 'from-pink-500 to-violet-500',
  tester: 'from-lime-400 to-emerald-500',
  writer: 'from-indigo-400 to-purple-500',
  discord: 'from-indigo-500 to-blue-600',
  custom: 'from-slate-400 to-slate-600',
};

interface Props { role: AgentRole; working?: boolean; size?: number; progress?: number; }

export function AgentOrb({ role, working = false, size = 44, progress }: Props) {
  const r = size / 2 - 3;
  const c = 2 * Math.PI * r;
  return (
    <div className="relative" style={{ width: size, height: size }}>
      {progress !== undefined && (
        <svg className="absolute inset-0 -rotate-90" width={size} height={size} aria-hidden>
          <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,.1)" strokeWidth="3" />
          <circle
            cx={size / 2} cy={size / 2} r={r} fill="none" stroke="url(#orbgrad)" strokeWidth="3"
            strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - Math.min(1, Math.max(0, progress)))}
          />
          <defs>
            <linearGradient id="orbgrad" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#7C3AED" /><stop offset="100%" stopColor="#06B6D4" />
            </linearGradient>
          </defs>
        </svg>
      )}
      <motion.div
        className={`absolute inset-[6px] rounded-full bg-gradient-to-br ${ROLE_GRADIENT[role]} ${working ? 'animate-pulseGlow' : ''}`}
        style={{ filter: working ? 'drop-shadow(0 0 12px rgba(124,58,237,.75))' : 'none' }}
        animate={working ? { scale: [1, 1.06, 1] } : { scale: 1 }}
        transition={{ repeat: working ? Infinity : 0, duration: 2.2, ease: 'easeInOut' }}
      />
    </div>
  );
}
