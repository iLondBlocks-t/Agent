import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowRight, Pause, Play, Square } from 'lucide-react';
import { GlassCard } from '@/components/GlassCard';
import { GradientButton } from '@/components/GradientButton';
import { Sparkles } from '@/components/Sparkles';
import { StepTimeline } from '@/components/StepTimeline';
import { useStore } from '@/store/useStore';

export default function TaskScreen() {
  const { id = '' } = useParams();
  const nav = useNavigate();
  const run = useStore((s) => s.runs.find((r) => r.id === id));
  const agents = useStore((s) => s.agents);
  const streaming = useStore((s) => s.streaming);
  const pauseRun = useStore((s) => s.pauseRun);
  const resumeRun = useStore((s) => s.resumeRun);
  const cancelRun = useStore((s) => s.cancelRun);
  const rerunFrom = useStore((s) => s.rerunFrom);
  const engine = useStore((s) => s.engine);
  const [paused, setPaused] = useState(false);
  const [burst, setBurst] = useState(false);

  const progress = useMemo(() => {
    if (!run?.nodes.length) return 0;
    return run.nodes.filter((n) => n.status === 'done').length / run.nodes.length;
  }, [run]);

  useEffect(() => {
    if (run?.status === 'done') {
      setBurst(true);
      const t = setTimeout(() => setBurst(false), 1000);
      return () => clearTimeout(t);
    }
    return undefined;
  }, [run?.status]);

  if (!run) {
    return (
      <div className="safe-top px-4">
        <p className="text-txt-lo">المهمة غير موجودة.</p>
        <GradientButton className="mt-4" onClick={() => nav('/')}>العودة</GradientButton>
      </div>
    );
  }

  const agentName = (aid?: string) => agents.find((a) => a.id === aid)?.name ?? 'غير محدد';

  return (
    <div className="safe-bottom">
      <Sparkles show={burst} />
      <header className="safe-top mb-4 px-4">
        <button onClick={() => nav(-1)} className="mb-3 flex min-h-[44px] items-center gap-2 text-[14px] text-txt-lo">
          <ArrowRight className="h-4 w-4" strokeWidth={1.6} /> رجوع
        </button>
        <h1 className="text-[20px] font-bold leading-snug text-txt-hi">{run.goal}</h1>
        <p className="mt-1 text-[12px] text-txt-lo">
          {run.status} · ${run.totalUsage.costUsd.toFixed(4)} · {run.totalUsage.totalTokens} توكن · وضع {run.mode}
        </p>
        <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/8">
          <div className="h-full grad-primary transition-all duration-500" style={{ width: `${progress * 100}%` }} />
        </div>
      </header>

      <div className="mb-4 flex gap-2 px-4">
        {engine && (paused ? (
          <GradientButton variant="ghost" className="flex-1" onClick={() => { resumeRun(); setPaused(false); }}>
            <Play className="h-4 w-4" strokeWidth={1.8} /> استئناف
          </GradientButton>
        ) : (
          <GradientButton variant="ghost" className="flex-1" onClick={() => { pauseRun(); setPaused(true); }}>
            <Pause className="h-4 w-4" strokeWidth={1.8} /> إيقاف مؤقت
          </GradientButton>
        ))}
        {engine && (
          <GradientButton variant="danger" className="flex-1" onClick={cancelRun}>
            <Square className="h-4 w-4" strokeWidth={1.8} /> إلغاء
          </GradientButton>
        )}
      </div>

      <div className="px-4">
        {run.nodes.length === 0 ? (
          <div className="space-y-3">
            {[0, 1, 2].map((i) => <div key={i} className="skeleton h-20" />)}
            <p className="text-center text-[13px] text-txt-lo">جارٍ بناء خطة المهام…</p>
          </div>
        ) : (
          <StepTimeline
            nodes={run.nodes}
            streaming={streaming}
            runId={run.id}
            agentName={agentName}
            onRerun={(nodeId) => void rerunFrom(run.id, nodeId)}
          />
        )}

        {run.summary && (
          <GlassCard glow className="mt-4">
            <h2 className="mb-2 text-[16px] font-bold grad-text">ملخص التسليم</h2>
            <pre className="whitespace-pre-wrap text-[13px] leading-relaxed text-txt-lo">{run.summary}</pre>
          </GlassCard>
        )}
      </div>
    </div>
  );
}
