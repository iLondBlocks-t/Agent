import { useState } from 'react';
import { Download, FileText, Plus, Trash2 } from 'lucide-react';
import { GlassCard } from '@/components/GlassCard';
import { GradientButton } from '@/components/GradientButton';
import { Header } from '@/components/Header';
import { useToast } from '@/components/Toast';
import { exportZip, saveTextToDownloads } from '@/core/tools/files';
import { useStore } from '@/store/useStore';

export default function Projects() {
  const files = useStore((s) => s.files);
  const writeFile = useStore((s) => s.writeFile);
  const deleteFile = useStore((s) => s.deleteFile);
  const toast = useToast();
  const [openPath, setOpenPath] = useState<string | null>(null);
  const [draft, setDraft] = useState('');

  const openFile = files.find((f) => f.path === openPath);

  async function doExport() {
    try {
      const res = await exportZip(files, 'workspace');
      toast.show(`تم التصدير: ${res.path}`, 'ok');
    } catch (e) { toast.show((e as Error).message, 'error'); }
  }

  return (
    <div className="safe-bottom">
      <Header title="المشاريع والملفات" subtitle={`${files.length} ملف في مساحة العمل المعزولة`} />
      <div className="space-y-3 px-4">
        <div className="flex gap-2">
          <GradientButton className="flex-1" onClick={doExport} disabled={!files.length}>
            <Download className="h-4 w-4" strokeWidth={1.8} /> تصدير ZIP
          </GradientButton>
          <GradientButton variant="ghost" onClick={() => {
            const path = `new-file-${files.length + 1}.txt`;
            writeFile(path, '');
            setOpenPath(path); setDraft('');
          }}>
            <Plus className="h-4 w-4" strokeWidth={1.8} />
          </GradientButton>
        </div>

        {files.map((f) => (
          <GlassCard key={f.path} className="!p-3">
            <div className="flex items-center gap-3">
              <FileText className="h-4 w-4 shrink-0 text-aurora-cyan" strokeWidth={1.6} />
              <button className="min-w-0 flex-1 text-start" onClick={() => { setOpenPath(f.path); setDraft(f.content); }}>
                <p className="truncate font-mono text-[13px] text-txt-hi" dir="ltr">{f.path}</p>
                <p className="text-[11px] text-txt-lo">{f.content.length} حرف · {new Date(f.updatedAt).toLocaleString('ar')}</p>
              </button>
              <button className="chip" onClick={() => void saveTextToDownloads(f.path.replace(/\//g, '_'), f.content)} aria-label="حفظ">
                <Download className="h-3.5 w-3.5" strokeWidth={1.6} />
              </button>
              <button className="chip text-danger" onClick={() => deleteFile(f.path)} aria-label="حذف">
                <Trash2 className="h-3.5 w-3.5" strokeWidth={1.6} />
              </button>
            </div>
          </GlassCard>
        ))}
        {!files.length && <p className="px-1 text-[13px] text-txt-lo">مساحة العمل فارغة — سينشئ الوكلاء الملفات هنا.</p>}
      </div>

      {openFile && (
        <div className="fixed inset-0 z-50 flex flex-col bg-black/85 p-4 backdrop-blur-md">
          <p className="mb-2 font-mono text-[13px] text-txt-hi" dir="ltr">{openFile.path}</p>
          <textarea className="field flex-1 font-mono text-[12px]" dir="ltr" value={draft} onChange={(e) => setDraft(e.target.value)} />
          <div className="mt-3 flex gap-2">
            <GradientButton className="flex-1" onClick={() => { writeFile(openFile.path, draft); setOpenPath(null); }}>حفظ</GradientButton>
            <GradientButton variant="ghost" onClick={() => setOpenPath(null)}>إغلاق</GradientButton>
          </div>
        </div>
      )}
    </div>
  );
}
