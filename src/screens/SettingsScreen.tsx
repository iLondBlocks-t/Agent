import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Eye, EyeOff, History as HistoryIcon, Wrench } from 'lucide-react';
import { GlassCard } from '@/components/GlassCard';
import { GradientButton } from '@/components/GradientButton';
import { Header } from '@/components/Header';
import { useToast } from '@/components/Toast';
import { useStore } from '@/store/useStore';

function Row({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 py-2.5">
      <div className="min-w-0">
        <p className="text-[14px] text-txt-hi">{label}</p>
        {hint && <p className="text-[11px] text-txt-lo">{hint}</p>}
      </div>
      {children}
    </div>
  );
}

export default function SettingsScreen() {
  const settings = useStore((s) => s.settings);
  const update = useStore((s) => s.updateSettings);
  const toast = useToast();
  const nav = useNavigate();
  const [showGh, setShowGh] = useState(false);
  const [showDc, setShowDc] = useState(false);

  return (
    <div className="safe-bottom">
      <Header title="الإعدادات" subtitle="التحكم الكامل في الأمان والمظهر والتكاملات" />
      <div className="space-y-3 px-4">
        <GlassCard>
          <h2 className="mb-1 text-[16px] font-bold text-txt-hi">الأمان</h2>
          <Row label="مفتاح الإيقاف العام" hint="يوقف كل استدعاءات الأدوات فورًا">
            <input type="checkbox" className="h-6 w-6 accent-red-500" checked={settings.killSwitch}
              onChange={(e) => void update({ killSwitch: e.target.checked })} />
          </Row>
          <Row label="حد الإنفاق اليومي العام ($)">
            <input type="number" min={0} step={1} className="field !w-28" value={settings.globalDailyLimitUsd}
              onChange={(e) => void update({ globalDailyLimitUsd: Number(e.target.value) })} />
          </Row>
          <Row label="أقصى تنفيذ متوازٍ">
            <input type="number" min={1} max={4} className="field !w-28" value={settings.maxParallel}
              onChange={(e) => void update({ maxParallel: Number(e.target.value) })} />
          </Row>
        </GlassCard>

        <GlassCard>
          <h2 className="mb-2 text-[16px] font-bold text-txt-hi">التكاملات</h2>
          <p className="mb-2 text-[12px] text-txt-lo">
            رمز GitHub: أنشئه من Settings ← Developer settings ← Personal access tokens (fine-grained) بصلاحيات repo وworkflow.
          </p>
          <div className="relative mb-3">
            <input className="field pe-12 font-mono text-[13px]" dir="ltr" type={showGh ? 'text' : 'password'}
              value={settings.githubToken} onChange={(e) => void update({ githubToken: e.target.value })} placeholder="GitHub token" autoComplete="off" />
            <button className="absolute end-3 top-1/2 -translate-y-1/2 text-txt-lo" onClick={() => setShowGh((v) => !v)} aria-label="إظهار">
              {showGh ? <EyeOff className="h-4 w-4" strokeWidth={1.6} /> : <Eye className="h-4 w-4" strokeWidth={1.6} />}
            </button>
          </div>
          <p className="mb-2 text-[12px] text-txt-lo">رمز بوت Discord: من Discord Developer Portal ← Bot ← Reset Token.</p>
          <div className="relative mb-3">
            <input className="field pe-12 font-mono text-[13px]" dir="ltr" type={showDc ? 'text' : 'password'}
              value={settings.discordBotToken} onChange={(e) => void update({ discordBotToken: e.target.value })} placeholder="Discord bot token" autoComplete="off" />
            <button className="absolute end-3 top-1/2 -translate-y-1/2 text-txt-lo" onClick={() => setShowDc((v) => !v)} aria-label="إظهار">
              {showDc ? <EyeOff className="h-4 w-4" strokeWidth={1.6} /> : <Eye className="h-4 w-4" strokeWidth={1.6} />}
            </button>
          </div>
          <p className="mb-2 text-[12px] text-txt-lo">خادم التنفيذ (Node.js) الاختياري — انظر مجلد server في المشروع.</p>
          <input className="field mb-2 font-mono text-[13px]" dir="ltr" value={settings.terminalBackendUrl}
            onChange={(e) => void update({ terminalBackendUrl: e.target.value })} placeholder="https://my-exec-server.example.com" />
          <input className="field font-mono text-[13px]" dir="ltr" type="password" value={settings.terminalBackendToken}
            onChange={(e) => void update({ terminalBackendToken: e.target.value })} placeholder="رمز الخادم (اختياري)" autoComplete="off" />
        </GlassCard>

        <GlassCard>
          <h2 className="mb-1 text-[16px] font-bold text-txt-hi">المظهر</h2>
          <Row label="الوضع الأسود التام (AMOLED)">
            <input type="checkbox" className="h-6 w-6 accent-violet-500" checked={settings.amoled}
              onChange={(e) => void update({ amoled: e.target.checked })} />
          </Row>
          <Row label="تقليل الحركة" hint="يحترم إعداد الجهاز ووضع توفير البطارية">
            <input type="checkbox" className="h-6 w-6 accent-violet-500" checked={settings.reduceMotion}
              onChange={(e) => void update({ reduceMotion: e.target.checked })} />
          </Row>
          <Row label="اللغة / Language">
            <div className="flex gap-1 rounded-full bg-white/5 p-1">
              {(['ar', 'en'] as const).map((l) => (
                <button key={l} onClick={() => void update({ language: l })}
                  className={`rounded-full px-3 py-1.5 text-[12px] ${settings.language === l ? 'grad-primary font-semibold text-white' : 'text-txt-lo'}`}>
                  {l === 'ar' ? 'العربية' : 'English'}
                </button>
              ))}
            </div>
          </Row>
        </GlassCard>

        <div className="flex gap-2">
          <GradientButton variant="ghost" className="flex-1" onClick={() => nav('/tools')}>
            <Wrench className="h-4 w-4" strokeWidth={1.8} /> الأدوات
          </GradientButton>
          <GradientButton variant="ghost" className="flex-1" onClick={() => nav('/history')}>
            <HistoryIcon className="h-4 w-4" strokeWidth={1.8} /> السجل
          </GradientButton>
        </div>

        <GradientButton variant="ghost" className="w-full" onClick={() => toast.show('الإعدادات تُحفظ تلقائيًا ✅', 'ok')}>
          تم
        </GradientButton>
      </div>
    </div>
  );
}
