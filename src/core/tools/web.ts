import { httpText, withRetry } from '../providers/http';
import { wrapUntrusted } from '../security/sanitize';
import type { Tool } from './types';
import { num, requireArg } from './types';

function stripHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

export const webFetch: Tool = {
  schema: {
    name: 'web_fetch', description: 'جلب صفحة ويب وتحويلها إلى نص نظيف.',
    permission: 'web', minLevel: 'read',
    parameters: {
      type: 'object',
      properties: { url: { type: 'string', description: 'رابط الصفحة' }, max_chars: { type: 'number', description: 'أقصى عدد أحرف (افتراضي 8000)' } },
      required: ['url'],
    },
  },
  async handler(args, ctx) {
    const url = requireArg(args, 'url');
    if (!/^https?:\/\//i.test(url)) throw new Error('رابط غير صالح');
    const html = await withRetry(() => httpText(url, { signal: ctx.signal, timeoutMs: 30_000, headers: { 'User-Agent': 'Mozilla/5.0 MAAO/1.0' } }), { signal: ctx.signal });
    const text = stripHtml(html).slice(0, Math.min(40_000, num(args, 'max_chars', 8000)));
    return { ok: true, output: wrapUntrusted(`web:${url}`, text) };
  },
};

export const webSearch: Tool = {
  schema: {
    name: 'web_search', description: 'بحث على الويب وإرجاع أهم النتائج (عنوان + رابط + مقتطف).',
    permission: 'web', minLevel: 'read',
    parameters: {
      type: 'object',
      properties: { query: { type: 'string', description: 'كلمات البحث' }, limit: { type: 'number', description: 'عدد النتائج (افتراضي 5)' } },
      required: ['query'],
    },
  },
  async handler(args, ctx) {
    const q = requireArg(args, 'query');
    const limit = Math.min(10, num(args, 'limit', 5));
    const html = await withRetry(
      () => httpText(`https://html.duckduckgo.com/html/?q=${encodeURIComponent(q)}`, {
        signal: ctx.signal, timeoutMs: 30_000, headers: { 'User-Agent': 'Mozilla/5.0 MAAO/1.0' },
      }),
      { signal: ctx.signal },
    );
    const results: { title: string; url: string; snippet: string }[] = [];
    const re = /<a[^>]+class="result__a"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>[\s\S]*?class="result__snippet"[^>]*>([\s\S]*?)<\/a>/gi;
    let m: RegExpExecArray | null;
    while ((m = re.exec(html)) && results.length < limit) {
      let href = m[1];
      const uddg = /uddg=([^&]+)/.exec(href);
      if (uddg) href = decodeURIComponent(uddg[1]);
      results.push({ title: stripHtml(m[2]), url: href, snippet: stripHtml(m[3]) });
    }
    if (!results.length) return { ok: false, output: 'لا توجد نتائج بحث (قد يكون هناك حجب شبكي)' };
    const text = results.map((r, i) => `${i + 1}. ${r.title}\n${r.url}\n${r.snippet}`).join('\n\n');
    return { ok: true, output: wrapUntrusted(`websearch:${q}`, text), data: results };
  },
};

export const WEB_TOOLS: Tool[] = [webSearch, webFetch];
