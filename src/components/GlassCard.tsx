import { motion, type HTMLMotionProps } from 'framer-motion';
import type { ReactNode } from 'react';

interface Props extends Omit<HTMLMotionProps<'div'>, 'children'> {
  children: ReactNode;
  className?: string;
  glow?: boolean;
  padded?: boolean;
}

export function GlassCard({ children, className = '', glow = false, padded = true, ...rest }: Props) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: 'spring', stiffness: 360, damping: 30 }}
      className={`glass relative rounded-[24px] ${padded ? 'p-4' : ''} ${className}`}
      {...rest}
    >
      {glow && (
        <div aria-hidden className="pointer-events-none absolute inset-0 rounded-[24px] opacity-60"
          style={{ background: 'linear-gradient(135deg, rgba(124,58,237,.18), transparent 60%)' }} />
      )}
      <div className="relative">{children}</div>
    </motion.div>
  );
}
