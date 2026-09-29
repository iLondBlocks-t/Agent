import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, CircleDot, CheckCircle2, XCircle, Loader2, PauseCircle } from 'lucide-react';
import { useState } from 'react';
import type { TaskNode, TaskStatus } from '@/types';

const ICON: Record<TaskStatus, JSX.Element> = {
  pending: <CircleDot className="h-4 w-4 text-txt-lo" strokeWidth={1.6} />,
  running: <Loader2 className="h-4 w-4 animate-spin text-aurora-cyan" strokeWidth={1.6} />,
  blocked: <PauseCircle className="h-4 w-4 text-warn" strokeWidth={1.6} />,
  paused: <PauseCircle className="h-4 w-4 text-warn" strokeWidth={1.6} />,
  done: <CheckCircle2 className="h-4 w-4 text-ok" strokeWidth={1.6} />,
  failed: <XCircle className="h-4 w-4 text-danger" strokeWidth={1.6} />,
  cancelled: <XCircle className="h-4 w-4 text-txt-lo" strokeWidth={1.6} />,
};

const DOT: Record<TaskStatus, string> = {
  pending: 'bg-white/25', running: 'bg-aurora-cyan', blocked: 'bg-warn', paused: 'bg-warn',
  done: 'bg-ok', failed: 'bg-danger', cancelled: 'bg-white/25',
};

interface Props {
  nodes: TaskNode[];
  streaming: Record<string, string>;
  runId: string;
  agentName(id?: string): string;
  onRerun(nodeId: string): void;
}

export function StepTimeline({ nodes, streaming, runId, agentName, onRerun }: Props) {
  const [open, setOpen] = useState<string | null>(nodes.find((n) => n.status === 'running')?.id ?? null);
  return (
    <ol className="relative space-y-3 ps-6">
      <div aria-hidden className="absolute bottom-2 top-2 start-[9px] w-px bg-gradient-to-b from-aurora-violet/60 via-white/10 to-transparent" />
      {nodes.map((node) => {
        const isOpen = open === node.id;
        const live = streaming[`${runId}:${node.id}`] ?? '';
        return (
          <li key={node.id} className="relative">
            <span className={`absolute -start-[19px] top-4 h-2.5 w-2.5 rounded-full ${DOT[node.status]} ring-4 ring-ink-950`} />
            <div className="glass overflow-hidden rounded-[22px]">
              <button
                onClick={() => setOpen(isOpen ? null : node.id)}
                className="flex min-h-[56px] w-full items-center gap-3 px-4 py-3 text-start"
              >
                {ICON[node.status]}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[15px] font-semibold text-txt-hi">{node.title}</p>
                  <p className="truncate text-[12px] text-txt-lo">
                    {agentName(node.agentId)} · ${node.usage.costUsd.toFixed(4)} · {node.usage.totalTokens} tok
                  </p>
                </div>
                <ChevronDown className={`h-4 w-4 shrink-0 text-txt-lo transition ${isOpen ? 'rotate-180' : ''}`} strokeWidth={1.6} />
              </button>
              <AnimatePresence initial={false}>
                {isOpen && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.28 }} className="border-t border-white/8"
                  >
                    <div className="space-y-3 px-4 py-3">
                      <p className="text-[13px] leading-relaxed text-txt-lo">{node.description}</p>
                      {node.logs.length > 0 && (
                        <div className="space-y-1 rounded-2xl bg-black/30 p-3">
                          {node.logs.map((l, i) => (
                            <p key={i} className="font-mono text-[11px] leading-relaxed text-txt-lo break-words">{l}</p>
                          ))}
                        </div>
                      )}
                      {(node.output || live) && (
                        <div className="max-h-72 overflow-auto whitespace-pre-wrap rounded-2xl bg-black/30 p-3 text-[13px] leading-relaxed text-txt-hi">
                          {node.output || live}
                        </div>
                      )}
                      {node.error && <p className="rounded-2xl bg-danger/10 p-3 text-[13px] text-danger">{node.error}</p>}
                      <button onClick={() => onRerun(node.id)} className="chip">إعادة التشغيل من هذه الخطوة</button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
