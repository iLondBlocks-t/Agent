import { motion } from 'framer-motion';
import { Sparkles as SparkIcon, Send, Activity, DollarSign, ListChecks } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AgentOrb } from '@/components/AgentOrb';
import { GlassCard } from '@/components/GlassCard';
import { GradientButton } from '@/components/GradientButton';
import { Header } from '@/components/Header';
import { useToast } from '@/components/Toast';
import { useT } from '@/hooks/useT';
import { useStore } from '@/store/useStore';
import type { RunMode } from '@/types';

const CHIPS = [
  'أنشئ موقع شخصي بسيط واحفظه في الملفات',
  'راجع مستودع GitHub وافتح Pull Request بالإصلاحات',
  'ابحث عن أفضل مكتبة رسوم بيانية واكتب تقريرًا',
  'اكتب اختبارات وحدة للمشروع الحالي',
];

export default function Dashboard() {
  const { t } = useT();
  const nav = useNavigate();
  const toast = useToast();
  const [goal, setGoal] = useState('');
  const [mode, setMode] = useState<RunMode>('semi');
  const agents = useStore((s) => s.agents);
  const providers = useStore((s) => s.providers);
  const runs = useStore((s) => s.runs);
  const spend = useStore((s) => s.spend);
  const startRun = useStore((s) => s.startRun);

  const activeRun = runs.find((r) => r.status === 'running' || r.status === 'blocked');
  const totalSpend = useMemo(() => Object.values(spend.byAgent).reduce((a, b) => a + b, 0), [spend]);

  async function launch() {
    if (!goal.trim()) return;
    if (!providers.length) { toast.show(t('noProviders'), 'error'); nav('/providers'); return; }
    if (!agents.length) { toast.show('أضف وكيلًا واحدًا على الأقل', 'error'); nav('/agents'); return; }
    const id = await startRun(goal.trim(), mode);
    setGoal('');
    nav(`/task/${id}`);
  }

  return (
    <div className="safe-bottom">
      <Header title={`${t('greeting')} 👋`} subtitle="منسّق متعدد الوكلاء — نفّذ أي مهمة من البداية للنهاية" />

      <div className="space-y-4 px-4">
        <motion.div
          className="relative rounded-[26px] p-[1.5px]"
          animate={{ backgroundPosition: ['0% 50%', '100% 50%', '0% 50%'] }}
          transition={{ duration: 8, repeat: Infinity, ease: 'linear' }}
          style={{ backgroundImage: 'linear-gradient(135deg,#7C3AED,#2563EB,#06B6D4,#7C3AED)', backgroundSize: '300% 300%' }}
        >
          <div className="rounded-[25px] bg-ink-950/90 p-4 backdrop-blur-xl">
            <textarea
              value={goal}
              onChange={(e) => setGoal(e.target.value)}
              placeholder={t('commandPlaceholder')}
              rows={3}
              className="w-full resize-none bg-transparent text-[16px] leading-relaxed text-txt-hi placeholder:text-txt-lo/70 outline-none"
            />
            <div className="mt-3 flex items-center justify-between gap-3">
              <div className="flex gap-1 rounded-full bg-white/5 p-1">
                {(['manual', 'semi', 'auto'] as RunMode[]).map((m) => (
                  <button
                    key={m} onClick={() => setMode(m)}
                    className={`rounded-full px-3 py-1.5 text-[12px] transition ${mode === m ? 'grad-primary font-semibold text-white' : 'text-txt-lo'}`}
                  >
                    {t(m)}
                  </button>
                ))}
              </div>
              <GradientButton onClick={launch} disabled={!goal.trim()} className="px-6">
                <Send className="h-4 w-4" strokeWidth={1.8} /> {t('run')}
              </GradientButton>
            </div>
          </div>
        </motion.div>

        <div className="flex gap-2 overflow-x-auto pb-1">
          {CHIPS.map((c) => (
            <button key={c} className="chip shrink-0" onClick={() => setGoal(c)}>{c}</button>
          ))}
        </div>

        <div className="grid grid-cols-3 gap-3">
          <GlassCard className="!p-3">
            <ListChecks className="mb-2 h-4 w-4 text-aurora-cyan" strokeWidth={1.6} />
            <p className="text-[20px] font-bold text-txt-hi">{runs.length}</p>
            <p className="text-[11px] text-txt-lo">مهام</p>
          </GlassCard>
          <GlassCard className="!p-3">
            <Activity className="mb-2 h-4 w-4 text-aurora-violet" strokeWidth={1.6} />
            <p className="text-[20px] font-bold text-txt-hi">{agents.filter((a) => a.enabled).length}</p>
            <p className="text-[11px] text-txt-lo">وكلاء نشطون</p>
          </GlassCard>
          <GlassCard className="!p-3">
            <DollarSign className="mb-2 h-4 w-4 text-ok" strokeWidth={1.6} />
            <p className="text-[20px] font-bold text-txt-hi">${totalSpend.toFixed(3)}</p>
            <p className="text-[11px] text-txt-lo">إنفاق اليوم</p>
          </GlassCard>
        </div>

        {activeRun && (
          <GlassCard glow onClick={() => nav(`/task/${activeRun.id}`)} className="cursor-pointer">
            <div className="flex items-center gap-3">
              <SparkIcon className="h-5 w-5 animate-pulse text-aurora-cyan" strokeWidth={1.6} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-[15px] font-semibold text-txt-hi">{activeRun.goal}</p>
                <p className="text-[12px] text-txt-lo">
                  {activeRun.nodes.filter((n) => n.status === 'done').length}/{activeRun.nodes.length} خطوة مكتملة
                </p>
              </div>
            </div>
          </GlassCard>
        )}

        <section>
          <h2 className="mb-2 px-1 text-[15px] font-semibold text-txt-hi">الوكلاء</h2>
          {agents.length === 0 ? (
            <GlassCard>
              <p className="text-[14px] text-txt-lo">لا يوجد وكلاء بعد.</p>
              <GradientButton className="mt-3 w-full" onClick={() => nav('/agents')}>إنشاء الوكلاء الجاهزين</GradientButton>
            </GlassCard>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              {agents.map((a) => {
                const working = !!activeRun?.nodes.some((n) => n.agentId === a.id && n.status === 'running');
                const spent = spend.byAgent[a.id] ?? 0;
                return (
                  <GlassCard key={a.id} className="!p-3" onClick={() => nav('/agents')}>
                    <div className="flex items-center gap-3">
                      <AgentOrb role={a.role} working={working} progress={Math.min(1, spent / Math.max(0.01, a.dailySpendLimitUsd))} />
                      <div className="min-w-0">
                        <p className="truncate text-[14px] font-semibold text-txt-hi">{a.name}</p>
                        <p className="truncate font-mono text-[10px] text-txt-lo">{a.model || 'بدون نموذج'}</p>
                        <p className={`text-[11px] ${working ? 'text-aurora-cyan' : 'text-txt-lo'}`}>
                          {working ? 'يعمل الآن…' : a.enabled ? 'جاهز' : 'معطّل'}
                        </p>
                      </div>
                    </div>
                  </GlassCard>
                );
              })}
            </div>
          )}
        </section>

        <section>
          <div className="mb-2 flex items-center justify-between px-1">
            <h2 className="text-[15px] font-semibold text-txt-hi">آخر المهام</h2>
            <button className="text-[13px] text-aurora-cyan" onClick={() => nav('/history')}>الكل</button>
          </div>
          {runs.length === 0 ? (
            <p className="px-1 text-[13px] text-txt-lo">{t('emptyRuns')}</p>
          ) : (
            <div className="space-y-2">
              {runs.slice(0, 4).map((r) => (
                <GlassCard key={r.id} className="!p-3" onClick={() => nav(`/task/${r.id}`)}>
                  <p className="truncate text-[14px] text-txt-hi">{r.goal}</p>
                  <p className="text-[11px] text-txt-lo">
                    {new Date(r.createdAt).toLocaleString('ar')} · {r.status} · ${r.totalUsage.costUsd.toFixed(4)}
                  </p>
                </GlassCard>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
