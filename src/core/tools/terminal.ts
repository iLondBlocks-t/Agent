import { httpJson, withRetry } from '../providers/http';
import { wrapUntrusted } from '../security/sanitize';
import type { Tool } from './types';
import { num, requireArg, str } from './types';

/**
 * Terminal / code execution via an OPTIONAL lightweight Node.js backend.
 * Set the URL + token in Settings. Reference server: `server/index.js` in this repo.
 * The backend enforces the real sandbox (temp dir, no network by default, timeout);
 * the app additionally blocks obviously destructive commands before sending.
 */
const HARD_BLOCK = [/rm\s+-rf\s+\//, /mkfs/, /:\(\)\{:\|:&\};:/, /shutdown/, /reboot/, /dd\s+if=/];

export const terminalRun: Tool = {
  schema: {
    name: 'terminal_run',
    description: 'تنفيذ أمر Shell داخل بيئة معزولة على الخادم الاختياري، مع مهلة والتقاط المخرجات.',
    permission: 'terminal', minLevel: 'write',
    parameters: {
      type: 'object',
      properties: {
        command: { type: 'string', description: 'الأمر المراد تنفيذه' },
        timeout_ms: { type: 'number', description: 'المهلة بالملي ثانية (افتراضي 60000)' },
      },
      required: ['command'],
    },
  },
  async handler(args, ctx) {
    const url = ctx.settings.terminalBackendUrl?.trim();
    if (!url) return { ok: false, output: 'لم يتم ضبط رابط خادم التنفيذ في الإعدادات — الأداة معطّلة.' };
    const command = requireArg(args, 'command');
    if (HARD_BLOCK.some((r) => r.test(command))) return { ok: false, output: 'أمر محظور لأسباب أمنية' };
    const res = await withRetry(() => httpJson<any>(`${url.replace(/\/+$/, '')}/exec`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(ctx.settings.terminalBackendToken ? { Authorization: `Bearer ${ctx.settings.terminalBackendToken}` } : {}) },
      body: JSON.stringify({ command, timeoutMs: num(args, 'timeout_ms', 60_000) }),
      timeoutMs: num(args, 'timeout_ms', 60_000) + 10_000,
      signal: ctx.signal,
    }), { retries: 1, signal: ctx.signal });
    const out = `exitCode=${res.exitCode}\n--- stdout ---\n${res.stdout ?? ''}\n--- stderr ---\n${res.stderr ?? ''}`;
    return { ok: res.exitCode === 0, output: wrapUntrusted('terminal', out), data: res };
  },
};

export const terminalWriteFile: Tool = {
  schema: {
    name: 'terminal_write_file',
    description: 'كتابة ملف داخل بيئة التنفيذ المعزولة على الخادم (قبل تشغيل الأوامر).',
    permission: 'terminal', minLevel: 'write',
    parameters: {
      type: 'object',
      properties: { path: { type: 'string', description: 'مسار نسبي' }, content: { type: 'string', description: 'المحتوى' } },
      required: ['path', 'content'],
    },
  },
  async handler(args, ctx) {
    const url = ctx.settings.terminalBackendUrl?.trim();
    if (!url) return { ok: false, output: 'لم يتم ضبط رابط خادم التنفيذ في الإعدادات.' };
    await httpJson(`${url.replace(/\/+$/, '')}/write`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(ctx.settings.terminalBackendToken ? { Authorization: `Bearer ${ctx.settings.terminalBackendToken}` } : {}) },
      body: JSON.stringify({ path: requireArg(args, 'path'), content: str(args, 'content') }),
      signal: ctx.signal,
    });
    return { ok: true, output: `تمت الكتابة على الخادم: ${str(args, 'path')}` };
  },
};

export const TERMINAL_TOOLS: Tool[] = [terminalRun, terminalWriteFile];
