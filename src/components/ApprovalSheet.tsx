import { AnimatePresence, motion } from 'framer-motion';
import { ShieldAlert } from 'lucide-react';
import type { ApprovalRequest } from '@/types';
import { GradientButton } from './GradientButton';

const RISK: Record<ApprovalRequest['risk'], { color: string; label: string }> = {
  low: { color: 'text-ok border-ok/40 bg-ok/10', label: 'خطورة منخفضة' },
  medium: { color: 'text-warn border-warn/40 bg-warn/10', label: 'خطورة متوسطة' },
  high: { color: 'text-danger border-danger/40 bg-danger/10', label: 'خطورة عالية' },
};

interface Props {
  approval: ApprovalRequest | null;
  agentName: string;
  onResolve(id: string, approved: boolean): void;
}

export function ApprovalSheet({ approval, agentName, onResolve }: Props) {
  return (
    <AnimatePresence>
      {approval && (
        <>
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
            onClick={() => onResolve(approval.id, false)}
          />
          <motion.div
            role="dialog" aria-modal="true"
            initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
            transition={{ type: 'spring', stiffness: 340, damping: 32 }}
            className="glass fixed inset-x-0 bottom-0 z-50 rounded-t-[28px] p-5 pb-8"
          >
            <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-white/20" />
            <div className="mb-3 flex items-center gap-3">
              <ShieldAlert className="h-6 w-6 text-warn" strokeWidth={1.6} />
              <div>
                <h2 className="text-[17px] font-bold text-txt-hi">طلب موافقة</h2>
                <p className="text-[13px] text-txt-lo">{agentName} يريد تنفيذ أداة</p>
              </div>
            </div>
            <div className={`mb-3 inline-block rounded-full border px-3 py-1 text-[12px] ${RISK[approval.risk].color}`}>
              {RISK[approval.risk].label}
            </div>
            <p className="mb-2 text-[14px] text-txt-hi">الأداة: <span className="font-mono">{approval.tool}</span></p>
            <p className="mb-3 text-[13px] text-txt-lo">{approval.reason}</p>
            <pre className="mb-5 max-h-44 overflow-auto rounded-2xl bg-black/40 p-3 font-mono text-[11px] text-txt-lo">
{JSON.stringify(approval.args, null, 2)}
            </pre>
            <div className="flex gap-3">
              <GradientButton variant="success" className="flex-1" onClick={() => onResolve(approval.id, true)}>موافقة</GradientButton>
              <GradientButton variant="danger" className="flex-1" onClick={() => onResolve(approval.id, false)}>رفض</GradientButton>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
