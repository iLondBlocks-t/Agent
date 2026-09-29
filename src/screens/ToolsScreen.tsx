import { ShieldCheck } from 'lucide-react';
import { GlassCard } from '@/components/GlassCard';
import { Header } from '@/components/Header';
import { TOOL_GROUPS } from '@/core/tools/registry';
import { useStore } from '@/store/useStore';

export default function ToolsScreen() {
  const agents = useStore((s) => s.agents);
  return (
    <div className="safe-bottom">
      <Header title="الأدوات والصلاحيات" subtitle="كل أداة تتطلب صلاحية محددة، وكل استدعاء يُفحص ويُسجَّل" />
      <div className="space-y-4 px-4">
        {TOOL_GROUPS.map((g) => (
          <GlassCard key={g.key}>
            <h2 className="mb-3 flex items-center gap-2 text-[16px] font-bold text-txt-hi">
              <ShieldCheck className="h-4 w-4 text-aurora-cyan" strokeWidth={1.6} /> {g.label}
            </h2>
            <div className="space-y-2">
              {g.tools.map((tool) => {
                const allowedFor = agents.filter((a) => a.allowedTools.includes(tool.schema.name));
                return (
                  <div key={tool.schema.name} className="rounded-2xl bg-white/5 p-3">
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-mono text-[12px] text-txt-hi">{tool.schema.name}</p>
                      <span className={`rounded-full px-2 py-0.5 text-[10px] ${tool.schema.destructive ? 'bg-danger/20 text-danger' : 'bg-white/10 text-txt-lo'}`}>
                        {tool.schema.permission}:{tool.schema.minLevel}
                      </span>
                    </div>
                    <p className="mt-1 text-[12px] leading-relaxed text-txt-lo">{tool.schema.description}</p>
                    <p className="mt-1 text-[11px] text-txt-lo">
                      مفعّلة لدى: {allowedFor.length ? allowedFor.map((a) => a.name).join('، ') : 'لا أحد'}
                    </p>
                  </div>
                );
              })}
            </div>
          </GlassCard>
        ))}
      </div>
    </div>
  );
}
