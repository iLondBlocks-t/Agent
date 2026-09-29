import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Trash2 } from 'lucide-react';
import { GlassCard } from '@/components/GlassCard';
import { GradientButton } from '@/components/GradientButton';
import { Header } from '@/components/Header';
import { useStore } from '@/store/useStore';

export default function History() {
  const runs = useStore((s) => s.runs);
  const audit = useStore((s) => s.audit);
  const deleteRun = useStore((s) => s.deleteRun);
  const clearAudit = useStore((s) => s.clearAudit);
  const nav = useNavigate();
  const [tab, setTab] = useState<'runs' | 'audit'>('runs');

  return (
    <div className="safe-bottom">
      <Header title="السجل والتدقيق" subtitle="كل المهام واستدعاءات الأدوات محفوظة محليًا" />
      <div className="px-4">
        <div className="mb-3 flex gap-1 rounded-full bg-white/5 p-1">
          {(['runs', 'audit'] as const).map((k) => (
            <button key={k} onClick={() => setTab(k)}
              className={`flex-1 rounded-full py-2 text-[13px] ${tab === k ? 'grad-primary font-semibold text-white' : 'text-txt-lo'}`}>
              {k === 'runs' ? 'المهام' : 'سجل التدقيق'}
            </button>
          ))}
        </div>

        {tab === 'runs' ? (
          <div className="space-y-2">
            {runs.map((r) => (
              <GlassCard key={r.id} className="!p-3">
                <div className="flex items-center gap-2">
                  <button className="min-w-0 flex-1 text-start" onClick={() => nav(`/task/${r.id}`)}>
                    <p className="truncate text-[14px] text-txt-hi">{r.goal}</p>
                    <p className="text-[11px] text-txt-lo">
                      {new Date(r.createdAt).toLocaleString('ar')} · {r.status} · ${r.totalUsage.costUsd.toFixed(4)} · {r.nodes.length} خطوة
                    </p>
                  </button>
                  <button className="chip text-danger" onClick={() => void deleteRun(r.id)} aria-label="حذف">
                    <Trash2 className="h-3.5 w-3.5" strokeWidth={1.6} />
                  </button>
                </div>
              </GlassCard>
            ))}
            {!runs.length && <p className="text-[13px] text-txt-lo">لا يوجد سجل بعد.</p>}
          </div>
        ) : (
          <div className="space-y-2">
            <GradientButton variant="ghost" className="w-full" onClick={() => void clearAudit()}>مسح سجل التدقيق</GradientButton>
            {audit.map((a) => (
              <div key={a.id} className={`rounded-2xl border p-3 ${a.allowed ? 'border-white/10 bg-white/5' : 'border-danger/40 bg-danger/10'}`}>
                <p className="font-mono text-[12px] text-txt-hi">{a.tool} — {a.action}</p>
                <p className="text-[11px] text-txt-lo">{new Date(a.ts).toLocaleString('ar')}</p>
                <p className="mt-1 break-words text-[12px] text-txt-lo">{a.detail}</p>
              </div>
            ))}
            {!audit.length && <p className="text-[13px] text-txt-lo">لا توجد سجلات.</p>}
          </div>
        )}
      </div>
    </div>
  );
}
