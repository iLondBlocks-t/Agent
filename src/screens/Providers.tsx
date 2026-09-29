import { useState } from 'react';
import { Eye, EyeOff, Plug, Plus, RefreshCw, Trash2 } from 'lucide-react';
import { GlassCard } from '@/components/GlassCard';
import { GradientButton } from '@/components/GradientButton';
import { Header } from '@/components/Header';
import { useToast } from '@/components/Toast';
import { PROVIDER_CATALOG, createProvider, metaFor } from '@/core/providers/registry';
import { maskKey } from '@/core/security/sanitize';
import { useStore } from '@/store/useStore';
import type { ModelInfo, ProviderKind } from '@/types';

export default function Providers() {
  const providers = useStore((s) => s.providers);
  const addProvider = useStore((s) => s.addProvider);
  const updateProvider = useStore((s) => s.updateProvider);
  const deleteProvider = useStore((s) => s.deleteProvider);
  const toast = useToast();

  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<ProviderKind>('openrouter');
  const [name, setName] = useState('OpenRouter');
  const [baseUrl, setBaseUrl] = useState(PROVIDER_CATALOG[0].defaultBaseUrl);
  const [apiKey, setApiKey] = useState('');
  const [model, setModel] = useState('');
  const [reveal, setReveal] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [models, setModels] = useState<Record<string, ModelInfo[]>>({});

  function pickKind(k: ProviderKind) {
    const meta = metaFor(k);
    setKind(k); setName(meta.label); setBaseUrl(meta.defaultBaseUrl);
  }

  async function submit() {
    if (!name.trim() || !baseUrl.trim()) { toast.show('الاسم والرابط مطلوبان', 'error'); return; }
    await addProvider({ kind, name: name.trim(), baseUrl: baseUrl.trim(), apiKey: apiKey.trim(), defaultModel: model.trim(), enabled: true });
    setApiKey(''); setModel(''); setOpen(false);
    toast.show('تمت إضافة المزوّد', 'ok');
  }

  async function test(id: string) {
    const cfg = providers.find((p) => p.id === id);
    if (!cfg) return;
    setBusy(id);
    try {
      const res = await createProvider(cfg).testConnection();
      toast.show(res.message, res.ok ? 'ok' : 'error');
    } catch (e) { toast.show((e as Error).message, 'error'); }
    finally { setBusy(null); }
  }

  async function loadModels(id: string) {
    const cfg = providers.find((p) => p.id === id);
    if (!cfg) return;
    setBusy(id);
    try {
      const list = await createProvider(cfg).listModels();
      setModels((m) => ({ ...m, [id]: list }));
      toast.show(`تم جلب ${list.length} نموذج`, 'ok');
    } catch (e) { toast.show((e as Error).message, 'error'); }
    finally { setBusy(null); }
  }

  return (
    <div className="safe-bottom">
      <Header title="المزوّدون والمفاتيح" subtitle="مفاتيحك مشفّرة على الجهاز ولا تُرسل إلا لمزوّدها" />
      <div className="space-y-3 px-4">
        <GradientButton className="w-full" onClick={() => setOpen((o) => !o)}>
          <Plus className="h-4 w-4" strokeWidth={1.8} /> إضافة مزوّد
        </GradientButton>

        {open && (
          <GlassCard glow>
            <div className="mb-3 flex flex-wrap gap-1.5">
              {PROVIDER_CATALOG.map((p) => (
                <button key={p.kind} onClick={() => pickKind(p.kind)}
                  className={`rounded-full border px-3 py-1.5 text-[12px] ${kind === p.kind ? 'border-aurora-violet/60 bg-aurora-violet/20 text-txt-hi' : 'border-white/10 bg-white/5 text-txt-lo'}`}>
                  {p.label}
                </button>
              ))}
            </div>
            <div className="space-y-3">
              <input className="field" value={name} onChange={(e) => setName(e.target.value)} placeholder="اسم المزوّد" />
              <input className="field font-mono text-[13px]" value={baseUrl} onChange={(e) => setBaseUrl(e.target.value)} placeholder="الرابط الأساسي" dir="ltr" />
              <div className="relative">
                <input className="field pe-12 font-mono text-[13px]" type={reveal ? 'text' : 'password'} value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)} placeholder="مفتاح API" dir="ltr" autoComplete="off" />
                <button onClick={() => setReveal((r) => !r)} className="absolute end-3 top-1/2 -translate-y-1/2 text-txt-lo" aria-label="إظهار المفتاح">
                  {reveal ? <EyeOff className="h-4 w-4" strokeWidth={1.6} /> : <Eye className="h-4 w-4" strokeWidth={1.6} />}
                </button>
              </div>
              <input className="field font-mono text-[13px]" value={model} onChange={(e) => setModel(e.target.value)} placeholder="النموذج الافتراضي" dir="ltr" />
              <p className="text-[12px] text-txt-lo">وثائق المفتاح: <span dir="ltr">{metaFor(kind).docs}</span></p>
              <div className="flex gap-2">
                <GradientButton className="flex-1" onClick={submit}>حفظ</GradientButton>
                <GradientButton variant="ghost" onClick={() => setOpen(false)}>إلغاء</GradientButton>
              </div>
            </div>
          </GlassCard>
        )}

        {providers.map((p) => (
          <GlassCard key={p.id}>
            <div className="flex items-start gap-3">
              <Plug className="mt-1 h-5 w-5 text-aurora-cyan" strokeWidth={1.6} />
              <div className="min-w-0 flex-1">
                <p className="text-[15px] font-semibold text-txt-hi">{p.name}</p>
                <p className="truncate font-mono text-[11px] text-txt-lo" dir="ltr">{p.baseUrl}</p>
                <p className="font-mono text-[11px] text-txt-lo" dir="ltr">{maskKey(p.apiKey ?? '') || 'بدون مفتاح'}</p>
              </div>
              <input type="checkbox" checked={p.enabled} onChange={(e) => void updateProvider(p.id, { enabled: e.target.checked })} className="h-5 w-5 accent-violet-500" />
            </div>
            <input className="field mt-3 font-mono text-[13px]" dir="ltr" value={p.defaultModel ?? ''}
              onChange={(e) => void updateProvider(p.id, { defaultModel: e.target.value })} placeholder="النموذج الافتراضي" />
            {models[p.id]?.length ? (
              <select className="field mt-2 font-mono text-[12px]" dir="ltr" value={p.defaultModel ?? ''}
                onChange={(e) => void updateProvider(p.id, { defaultModel: e.target.value })}>
                {models[p.id].map((m) => <option key={m.id} value={m.id} className="bg-ink-900">{m.id}</option>)}
              </select>
            ) : null}
            <div className="mt-3 flex gap-2">
              <button className="chip flex-1" disabled={busy === p.id} onClick={() => void test(p.id)}>
                {busy === p.id ? '…' : 'اختبار الاتصال'}
              </button>
              <button className="chip flex-1" disabled={busy === p.id} onClick={() => void loadModels(p.id)}>
                <RefreshCw className="inline h-3.5 w-3.5" strokeWidth={1.6} /> النماذج
              </button>
              <button className="chip text-danger" onClick={() => void deleteProvider(p.id)} aria-label="حذف">
                <Trash2 className="h-4 w-4" strokeWidth={1.6} />
              </button>
            </div>
          </GlassCard>
        ))}
        {providers.length === 0 && !open && <p className="px-1 text-[13px] text-txt-lo">لم تضف أي مزوّد بعد.</p>}
      </div>
    </div>
  );
}
