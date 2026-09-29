import { ShieldOff } from 'lucide-react';
import { useStore } from '@/store/useStore';

export function Header({ title, subtitle }: { title: string; subtitle?: string }) {
  const kill = useStore((s) => s.settings.killSwitch);
  return (
    <header className="safe-top mb-4 px-4">
      <h1 className="text-[24px] font-bold tracking-tight text-txt-hi">{title}</h1>
      {subtitle && <p className="mt-1 text-[13px] text-txt-lo">{subtitle}</p>}
      {kill && (
        <div className="mt-3 flex items-center gap-2 rounded-2xl border border-danger/40 bg-danger/10 px-3 py-2 text-[13px] text-danger">
          <ShieldOff className="h-4 w-4" strokeWidth={1.6} /> مفتاح الإيقاف العام مفعّل — كل الأدوات معطّلة
        </div>
      )}
    </header>
  );
}
