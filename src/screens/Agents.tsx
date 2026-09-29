import { useState } from 'react';
import { Plus, Trash2, Save } from 'lucide-react';
import { AgentOrb } from '@/components/AgentOrb';
import { GlassCard } from '@/components/GlassCard';
import { GradientButton } from '@/components/GradientButton';
import { Header } from '@/components/Header';
import { useToast } from '@/components/Toast';
import { AGENT_PRESETS } from '@/core/agents/presets';
import { TOOL_GROUPS } from '@/core/tools/registry';
import { useStore } from '@/store/useStore';
import type { Agent, PermissionLevel } from '@/types';

const LEVELS: PermissionLevel[] = ['off', 'read', 'write', 'admin'];
const PERM_KEYS = ['github', 'discord', 'files', 'terminal', 'web'] as const;
const PERM_LABEL: Record<(typeof PERM_KEYS)[number], string> = {
  github: 'GitHub', discord: 'Discord', files: 'الملفات', terminal: 'الطرفية', web: 'الويب',
};

export default function Agents() {
  const agents = useStore((s) => s.agents);
  const providers = useStore((s) => s.providers);
  const seedPresets = useStore((s) => s.seedPresets);
  const addAgent = useStore((s) => s.addAgent);
  const updateAgent = useStore((s) => s.updateAgent);
  const deleteAgent = useStore((s) => s.deleteAgent);
  const spend = useStore((s) => s.spend);
  const toast = useToast();
  const [editing, setEditing] = useState<Agent | null>(null);

  async function seed() {
    const p = providers[0];
    if (!p) { toast.show('أضف مزوّدًا أولاً', 'error'); return; }
    await seedPresets(p.id, p.defaultModel || '');
    toast.show('تم إنشاء الوكلاء الجاهزين', 'ok');
  }

  async function createCustom() {
    const p = providers[0];
    if (!p) { toast.show('أضف مزوّدًا أولاً', 'error'); return; }
    const a = await addAgent({
      name: 'وكيل مخصص', role: 'custom', systemPrompt: 'أنت وكيل مساعد. نفّذ المهمة المطلوبة بدقة بالعربية.',
      providerId: p.id, model: p.defaultModel || '', allowedTools: [],
      permissions: { github: 'off', discord: 'off', files: 'read', terminal: 'off', web: 'read' },
      temperature: 0.4, dailySpendLimitUsd: 1, enabled: true, quality: 0.7, speed: 0.8, costFactor: 0.4,
    });
    setEditing(a);
  }

  return (
    <div className="safe-bottom">
      <Header title="الوكلاء" subtitle="كل وكيل له دور وصلاحيات ونموذج خاص" />
      <div className="space-y-3 px-4">
        <div className="flex gap-2">
          <GradientButton className="flex-1" onClick={seed}><Plus className="h-4 w-4" strokeWidth={1.8} /> وكلاء جاهزون ({AGENT_PRESETS.length})</GradientButton>
          <GradientButton variant="ghost" onClick={createCustom}>مخصص</GradientButton>
        </div>

        {agents.map((a) => (
          <GlassCard key={a.id}>
            <div className="flex items-center gap-3">
              <AgentOrb role={a.role} progress={Math.min(1, (spend.byAgent[a.id] ?? 0) / Math.max(0.01, a.dailySpendLimitUsd))} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-[15px] font-semibold text-txt-hi">{a.name}</p>
                <p className="truncate font-mono text-[11px] text-txt-lo">{a.model || 'بدون نموذج'} · {a.allowedTools.length} أداة</p>
              </div>
              <label className="flex items-center gap-2 text-[12px] text-txt-lo">
                <input type="checkbox" checked={a.enabled} onChange={(e) => void updateAgent(a.id, { enabled: e.target.checked })} className="h-5 w-5 accent-violet-500" />
              </label>
            </div>
            <div className="mt-3 flex gap-2">
              <button className="chip flex-1" onClick={() => setEditing(a)}>تعديل</button>
              <button className="chip text-danger" onClick={() => void deleteAgent(a.id)} aria-label="حذف">
                <Trash2 className="h-4 w-4" strokeWidth={1.6} />
              </button>
            </div>
          </GlassCard>
        ))}

        {agents.length === 0 && <p className="px-1 text-[13px] text-txt-lo">لا يوجد وكلاء بعد.</p>}
      </div>

      {editing && (
        <div className="fixed inset-0 z-50 overflow-auto bg-black/80 backdrop-blur-md p-4">
          <GlassCard className="mx-auto max-w-lg">
            <h2 className="mb-3 text-[18px] font-bold text-txt-hi">تعديل الوكيل</h2>
            <div className="space-y-3">
              <input className="field" value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} placeholder="الاسم" />
              <textarea className="field min-h-[120px]" value={editing.systemPrompt} onChange={(e) => setEditing({ ...editing, systemPrompt: e.target.value })} placeholder="تعليمات النظام" />
              <select className="field" value={editing.providerId} onChange={(e) => setEditing({ ...editing, providerId: e.target.value })}>
                {providers.map((p) => <option key={p.id} value={p.id} className="bg-ink-900">{p.name}</option>)}
              </select>
              <input className="field font-mono" value={editing.model} onChange={(e) => setEditing({ ...editing, model: e.target.value })} placeholder="اسم النموذج" />
              <div className="grid grid-cols-2 gap-3">
                <select className="field" value={editing.fallbackProviderId ?? ''} onChange={(e) => setEditing({ ...editing, fallbackProviderId: e.target.value || undefined })}>
                  <option value="" className="bg-ink-900">مزوّد احتياطي (اختياري)</option>
                  {providers.map((p) => <option key={p.id} value={p.id} className="bg-ink-900">{p.name}</option>)}
                </select>
                <input className="field font-mono" value={editing.fallbackModel ?? ''} onChange={(e) => setEditing({ ...editing, fallbackModel: e.target.value || undefined })} placeholder="نموذج احتياطي" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <label className="text-[13px] text-txt-lo">
                  درجة الحرارة: {editing.temperature.toFixed(2)}
                  <input type="range" min={0} max={1} step={0.05} value={editing.temperature}
                    onChange={(e) => setEditing({ ...editing, temperature: Number(e.target.value) })} className="w-full accent-violet-500" />
                </label>
                <label className="text-[13px] text-txt-lo">
                  حد الإنفاق اليومي ($)
                  <input type="number" min={0} step={0.5} className="field" value={editing.dailySpendLimitUsd}
                    onChange={(e) => setEditing({ ...editing, dailySpendLimitUsd: Number(e.target.value) })} />
                </label>
              </div>

              <div>
                <p className="mb-2 text-[14px] font-semibold text-txt-hi">الصلاحيات</p>
                <div className="space-y-2">
                  {PERM_KEYS.map((k) => (
                    <div key={k} className="flex items-center justify-between gap-2">
                      <span className="text-[13px] text-txt-lo">{PERM_LABEL[k]}</span>
                      <div className="flex gap-1 rounded-full bg-white/5 p-1">
                        {LEVELS.map((lv) => (
                          <button key={lv}
                            onClick={() => setEditing({ ...editing, permissions: { ...editing.permissions, [k]: lv } })}
                            className={`rounded-full px-2.5 py-1 text-[11px] ${editing.permissions[k] === lv ? 'grad-primary font-semibold text-white' : 'text-txt-lo'}`}>
                            {lv}
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <p className="mb-2 text-[14px] font-semibold text-txt-hi">الأدوات المسموحة</p>
                {TOOL_GROUPS.map((g) => (
                  <div key={g.key} className="mb-2">
                    <p className="mb-1 text-[12px] text-txt-lo">{g.label}</p>
                    <div className="flex flex-wrap gap-1.5">
                      {g.tools.map((tool) => {
                        const on = editing.allowedTools.includes(tool.schema.name);
                        return (
                          <button key={tool.schema.name}
                            onClick={() => setEditing({
                              ...editing,
                              allowedTools: on
                                ? editing.allowedTools.filter((n) => n !== tool.schema.name)
                                : [...editing.allowedTools, tool.schema.name],
                            })}
                            className={`rounded-full border px-2.5 py-1 font-mono text-[11px] ${on ? 'border-aurora-violet/60 bg-aurora-violet/20 text-txt-hi' : 'border-white/10 bg-white/5 text-txt-lo'}`}>
                            {tool.schema.name}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex gap-2 pt-2">
                <GradientButton className="flex-1" onClick={async () => { await updateAgent(editing.id, editing); setEditing(null); toast.show('تم الحفظ', 'ok'); }}>
                  <Save className="h-4 w-4" strokeWidth={1.8} /> حفظ
                </GradientButton>
                <GradientButton variant="ghost" onClick={() => setEditing(null)}>إغلاق</GradientButton>
              </div>
            </div>
          </GlassCard>
        </div>
      )}
    </div>
  );
}
