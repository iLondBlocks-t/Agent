import { memo } from 'react';
import { useStore } from '@/store/useStore';

/** Slowly drifting aurora glows on a deep black canvas. */
export const AuroraBackground = memo(function AuroraBackground() {
  const reduce = useStore((s) => s.settings.reduceMotion);
  const amoled = useStore((s) => s.settings.amoled);
  const anim = reduce ? '' : 'animate-drift';
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden" style={{ background: amoled ? '#000' : '#05050A' }}>
      <div className={`absolute -top-32 -start-24 h-[420px] w-[420px] rounded-full blur-[110px] opacity-40 ${anim}`}
        style={{ background: 'radial-gradient(circle, #7C3AED 0%, transparent 70%)' }} />
      <div className={`absolute top-1/3 -end-28 h-[380px] w-[380px] rounded-full blur-[120px] opacity-35 ${anim}`}
        style={{ background: 'radial-gradient(circle, #2563EB 0%, transparent 70%)', animationDelay: '-7s' }} />
      <div className={`absolute bottom-0 start-1/4 h-[340px] w-[340px] rounded-full blur-[120px] opacity-30 ${anim}`}
        style={{ background: 'radial-gradient(circle, #06B6D4 0%, transparent 70%)', animationDelay: '-13s' }} />
      <div className={`absolute bottom-24 end-1/3 h-[220px] w-[220px] rounded-full blur-[110px] opacity-20 ${anim}`}
        style={{ background: 'radial-gradient(circle, #EC4899 0%, transparent 70%)', animationDelay: '-4s' }} />
    </div>
  );
});
