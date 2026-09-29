import type { ChatMessage, Provider } from '@/types';

export interface MemoryEntry { id: string; ts: number; scope: 'project' | 'long'; text: string; }

const MAX_SHORT = 12;

export class ProjectMemory {
  private entries: MemoryEntry[] = [];
  constructor(initial: MemoryEntry[] = []) { this.entries = [...initial]; }

  add(text: string, scope: MemoryEntry['scope'] = 'project'): void {
    if (!text?.trim()) return;
    this.entries.push({ id: crypto.randomUUID(), ts: Date.now(), scope, text: text.trim().slice(0, 4000) });
  }

  all(): MemoryEntry[] { return [...this.entries]; }

  recent(n = MAX_SHORT): MemoryEntry[] { return this.entries.slice(-n); }

  contextBlock(n = MAX_SHORT): string {
    const longTerm = this.entries.filter((e) => e.scope === 'long').slice(-5);
    const short = this.recent(n);
    const lines = [...longTerm, ...short].map((e) => `- ${e.text}`);
    return lines.length ? `ذاكرة المشروع المشتركة:\n${lines.join('\n')}` : '';
  }

  /** Automatic summarization: compress old entries into one long-term memory item. */
  async summarizeIfNeeded(provider: Provider, model: string): Promise<void> {
    if (this.entries.length <= MAX_SHORT * 2) return;
    const old = this.entries.slice(0, this.entries.length - MAX_SHORT);
    const keep = this.entries.slice(this.entries.length - MAX_SHORT);
    const messages: ChatMessage[] = [
      { role: 'system', content: 'لخّص السجل التالي في نقاط موجزة جدًا تحفظ القرارات والحقائق المهمة فقط. بالعربية.' },
      { role: 'user', content: old.map((e) => `- ${e.text}`).join('\n').slice(0, 20_000) },
    ];
    try {
      const res = await provider.chat({ model, messages, temperature: 0.2, maxTokens: 700 });
      this.entries = [{ id: crypto.randomUUID(), ts: Date.now(), scope: 'long', text: `ملخّص سابق:\n${res.content}` }, ...keep];
    } catch {
      this.entries = keep;
    }
  }
}
