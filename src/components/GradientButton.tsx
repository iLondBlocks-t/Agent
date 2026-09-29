import { motion } from 'framer-motion';
import type { ReactNode } from 'react';
import { haptic } from '@/core/platform/native';

interface Props {
  children: ReactNode;
  onClick?: () => void;
  variant?: 'primary' | 'ghost' | 'danger' | 'success';
  disabled?: boolean;
  className?: string;
  type?: 'button' | 'submit';
  ariaLabel?: string;
}

const styles: Record<string, string> = {
  primary: 'grad-primary text-white shadow-[0_8px_28px_-8px_rgba(124,58,237,.8)]',
  ghost: 'bg-white/5 border border-white/12 text-txt-hi',
  danger: 'bg-gradient-to-br from-red-500 to-rose-600 text-white shadow-[0_8px_28px_-8px_rgba(239,68,68,.7)]',
  success: 'bg-gradient-to-br from-emerald-500 to-teal-500 text-white shadow-[0_8px_28px_-8px_rgba(34,197,94,.7)]',
};

export function GradientButton({ children, onClick, variant = 'primary', disabled, className = '', type = 'button', ariaLabel }: Props) {
  return (
    <motion.button
      type={type}
      aria-label={ariaLabel}
      disabled={disabled}
      whileTap={disabled ? undefined : { scale: 0.96 }}
      whileHover={disabled ? undefined : { y: -2 }}
      transition={{ type: 'spring', stiffness: 400, damping: 26 }}
      onClick={() => { if (disabled) return; void haptic('light'); onClick?.(); }}
      className={`inline-flex min-h-[48px] items-center justify-center gap-2 rounded-2xl px-5 text-[15px] font-semibold
        transition disabled:cursor-not-allowed disabled:opacity-40 ${styles[variant]} ${className}`}
    >
      {children}
    </motion.button>
  );
}
