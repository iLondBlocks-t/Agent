import { AnimatePresence, motion } from 'framer-motion';
import { create } from 'zustand';

interface ToastState {
  message: string | null;
  kind: 'ok' | 'error' | 'info';
  show(message: string, kind?: 'ok' | 'error' | 'info'): void;
  hide(): void;
}

export const useToast = create<ToastState>((set) => ({
  message: null,
  kind: 'info',
  show(message, kind = 'info') {
    set({ message, kind });
    setTimeout(() => set({ message: null }), 3600);
  },
  hide: () => set({ message: null }),
}));

export function Toast() {
  const { message, kind, hide } = useToast();
  const color = kind === 'ok' ? 'border-ok/40 text-ok' : kind === 'error' ? 'border-danger/40 text-danger' : 'border-white/15 text-txt-hi';
  return (
    <AnimatePresence>
      {message && (
        <motion.button
          onClick={hide}
          initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}
          className={`glass fixed inset-x-4 top-4 z-[60] rounded-2xl border px-4 py-3 text-start text-[14px] ${color}`}
        >
          {message}
        </motion.button>
      )}
    </AnimatePresence>
  );
}
