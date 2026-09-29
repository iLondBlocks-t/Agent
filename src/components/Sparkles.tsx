import { AnimatePresence, motion } from 'framer-motion';

/** Sparkle burst shown when a task completes. */
export function Sparkles({ show }: { show: boolean }) {
  const dots = Array.from({ length: 14 }, (_, i) => i);
  return (
    <AnimatePresence>
      {show && (
        <div className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center">
          {dots.map((i) => {
            const angle = (i / dots.length) * Math.PI * 2;
            return (
              <motion.span
                key={i}
                initial={{ opacity: 1, x: 0, y: 0, scale: 0.4 }}
                animate={{ opacity: 0, x: Math.cos(angle) * 160, y: Math.sin(angle) * 160, scale: 1.2 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.9, ease: 'easeOut' }}
                className="absolute h-2 w-2 rounded-full"
                style={{ background: i % 2 ? '#06B6D4' : '#7C3AED', boxShadow: '0 0 12px currentColor' }}
              />
            );
          })}
        </div>
      )}
    </AnimatePresence>
  );
}
