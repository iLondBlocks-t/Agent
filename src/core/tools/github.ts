import { httpJson, withRetry } from '../providers/http';
import { wrapUntrusted } from '../security/sanitize';
import type { Tool, ToolContext, ToolResult } from './types';
import { bool, num, requireArg, str } from './types';

const API = 'https://api.github.com';

function gh(ctx: ToolContext) {
  const token = ctx.settings.githubToken?.trim();
  if (!token) throw new Error('لم يتم ضبط رمز GitHub في الإعدادات');
  return {
    Authorization: `Bearer ${token}`,
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    'Content-Type': 'application/json',
  };
}

async function call<T = any>(ctx: ToolContext, path: string, init: RequestInit = {}): Promise<T> {
  return withRetry(() => httpJson<T>(`${API}${path}`, { ...init, headers: gh(ctx), signal: ctx.signal }), { signal: ctx.signal });
}

function b64encode(s: string): string {
  return btoa(String.fromCharCode(...new TextEncoder().encode(s)));
}
function b64decode(s: string): string {
  const bin = atob(s.replace(/\n/g, ''));
  return new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0)));
}

export const githubListRepos: Tool = {
  schema: {
    name: 'github_list_repos', description: 'سرد مستودعات المستخدم على GitHub.',
    permission: 'github', minLevel: 'read',
    parameters: { type: 'object', properties: { per_page: { type: 'number', description: 'عدد النتائج (افتراضي 30)' } }, required: [] },
  },
  async handler(args, ctx): Promise<ToolResult> {
    const data = await call<any[]>(ctx, `/user/repos?per_page=${num(args, 'per_page', 30)}&sort=updated`);
    return { ok: true, output: data.map((r) => `${r.full_name} (${r.private ? 'خاص' : 'عام'}) — ${r.default_branch}`).join('\n') || 'لا توجد مستودعات', data };
  },
};

export const githubReadFile: Tool = {
  schema: {
    name: 'github_read_file', description: 'قراءة ملف من مستودع GitHub.',
    permission: 'github', minLevel: 'read',
    parameters: {
      type: 'object',
      properties: {
        repo: { type: 'string', description: 'owner/repo' },
        path: { type: 'string', description: 'مسار الملف' },
        ref: { type: 'string', description: 'الفرع أو الـ commit (اختياري)' },
      },
      required: ['repo', 'path'],
    },
  },
  async handler(args, ctx) {
    const repo = requireArg(args, 'repo'); const path = requireArg(args, 'path');
    const ref = str(args, 'ref');
    const data = await call<any>(ctx, `/repos/${repo}/contents/${encodeURI(path)}${ref ? `?ref=${encodeURIComponent(ref)}` : ''}`);
    if (Array.isArray(data)) return { ok: true, output: data.map((d: any) => `${d.type}: ${d.path}`).join('\n') };
    return { ok: true, output: wrapUntrusted(`github:${repo}/${path}`, b64decode(data.content ?? '')), data: { sha: data.sha } };
  },
};

export const githubWriteFile: Tool = {
  schema: {
    name: 'github_write_file', description: 'إنشاء أو تحديث ملف في مستودع GitHub (commit مباشر).',
    permission: 'github', minLevel: 'write',
    parameters: {
      type: 'object',
      properties: {
        repo: { type: 'string', description: 'owner/repo' },
        path: { type: 'string', description: 'مسار الملف' },
        content: { type: 'string', description: 'المحتوى الجديد' },
        message: { type: 'string', description: 'رسالة الـ commit' },
        branch: { type: 'string', description: 'الفرع (اختياري)' },
      },
      required: ['repo', 'path', 'content', 'message'],
    },
  },
  async handler(args, ctx) {
    const repo = requireArg(args, 'repo'); const path = requireArg(args, 'path');
    const branch = str(args, 'branch');
    let sha: string | undefined;
    try {
      const cur = await call<any>(ctx, `/repos/${repo}/contents/${encodeURI(path)}${branch ? `?ref=${branch}` : ''}`);
      sha = cur?.sha;
    } catch { /* new file */ }
    const res = await call<any>(ctx, `/repos/${repo}/contents/${encodeURI(path)}`, {
      method: 'PUT',
      body: JSON.stringify({ message: str(args, 'message'), content: b64encode(str(args, 'content')), ...(sha ? { sha } : {}), ...(branch ? { branch } : {}) }),
    });
    return { ok: true, output: `تم الحفظ: ${res.content?.path} @ ${res.commit?.sha?.slice(0, 7)}` };
  },
};

export const githubCreateBranch: Tool = {
  schema: {
    name: 'github_create_branch', description: 'إنشاء فرع جديد من فرع أساسي.',
    permission: 'github', minLevel: 'write',
    parameters: {
      type: 'object',
      properties: {
        repo: { type: 'string', description: 'owner/repo' },
        branch: { type: 'string', description: 'اسم الفرع الجديد' },
        from: { type: 'string', description: 'الفرع الأساسي (افتراضي: الافتراضي للمستودع)' },
      },
      required: ['repo', 'branch'],
    },
  },
  async handler(args, ctx) {
    const repo = requireArg(args, 'repo');
    const info = await call<any>(ctx, `/repos/${repo}`);
    const from = str(args, 'from', info.default_branch);
    const ref = await call<any>(ctx, `/repos/${repo}/git/ref/heads/${from}`);
    await call(ctx, `/repos/${repo}/git/refs`, { method: 'POST', body: JSON.stringify({ ref: `refs/heads/${requireArg(args, 'branch')}`, sha: ref.object.sha }) });
    return { ok: true, output: `تم إنشاء الفرع ${str(args, 'branch')} من ${from}` };
  },
};

export const githubCreatePR: Tool = {
  schema: {
    name: 'github_create_pr', description: 'فتح Pull Request.',
    permission: 'github', minLevel: 'write',
    parameters: {
      type: 'object',
      properties: {
        repo: { type: 'string', description: 'owner/repo' },
        title: { type: 'string', description: 'العنوان' },
        head: { type: 'string', description: 'الفرع المصدر' },
        base: { type: 'string', description: 'الفرع الهدف' },
        body: { type: 'string', description: 'الوصف' },
      },
      required: ['repo', 'title', 'head', 'base'],
    },
  },
  async handler(args, ctx) {
    const pr = await call<any>(ctx, `/repos/${requireArg(args, 'repo')}/pulls`, {
      method: 'POST',
      body: JSON.stringify({ title: requireArg(args, 'title'), head: requireArg(args, 'head'), base: requireArg(args, 'base'), body: str(args, 'body') }),
    });
    return { ok: true, output: `تم فتح PR #${pr.number}: ${pr.html_url}` };
  },
};

export const githubIssues: Tool = {
  schema: {
    name: 'github_issues', description: 'سرد أو إنشاء أو إغلاق issue.',
    permission: 'github', minLevel: 'read',
    parameters: {
      type: 'object',
      properties: {
        repo: { type: 'string', description: 'owner/repo' },
        action: { type: 'string', description: 'list | create | close', enum: ['list', 'create', 'close'] },
        title: { type: 'string', description: 'عنوان الـ issue عند الإنشاء' },
        body: { type: 'string', description: 'وصف الـ issue' },
        number: { type: 'number', description: 'رقم الـ issue عند الإغلاق' },
      },
      required: ['repo', 'action'],
    },
  },
  async handler(args, ctx) {
    const repo = requireArg(args, 'repo');
    const action = str(args, 'action', 'list');
    if (action === 'create') {
      const i = await call<any>(ctx, `/repos/${repo}/issues`, { method: 'POST', body: JSON.stringify({ title: requireArg(args, 'title'), body: str(args, 'body') }) });
      return { ok: true, output: `تم إنشاء issue #${i.number}: ${i.html_url}` };
    }
    if (action === 'close') {
      const n = num(args, 'number');
      await call(ctx, `/repos/${repo}/issues/${n}`, { method: 'PATCH', body: JSON.stringify({ state: 'closed' }) });
      return { ok: true, output: `تم إغلاق issue #${n}` };
    }
    const list = await call<any[]>(ctx, `/repos/${repo}/issues?state=open&per_page=30`);
    return { ok: true, output: list.map((i) => `#${i.number} ${i.title}`).join('\n') || 'لا توجد issues' };
  },
};

export const githubActions: Tool = {
  schema: {
    name: 'github_actions', description: 'تشغيل workflow أو قراءة حالة آخر التشغيلات.',
    permission: 'github', minLevel: 'write',
    parameters: {
      type: 'object',
      properties: {
        repo: { type: 'string', description: 'owner/repo' },
        action: { type: 'string', description: 'list | dispatch', enum: ['list', 'dispatch'] },
        workflow: { type: 'string', description: 'اسم ملف الـ workflow مثل build-apk.yml' },
        ref: { type: 'string', description: 'الفرع' },
      },
      required: ['repo', 'action'],
    },
  },
  async handler(args, ctx) {
    const repo = requireArg(args, 'repo');
    if (str(args, 'action') === 'dispatch') {
      await call(ctx, `/repos/${repo}/actions/workflows/${requireArg(args, 'workflow')}/dispatches`, {
        method: 'POST', body: JSON.stringify({ ref: str(args, 'ref', 'main') }),
      });
      return { ok: true, output: 'تم تشغيل الـ workflow' };
    }
    const runs = await call<any>(ctx, `/repos/${repo}/actions/runs?per_page=10`);
    return { ok: true, output: (runs.workflow_runs ?? []).map((r: any) => `${r.name}: ${r.status}/${r.conclusion ?? '-'} → ${r.html_url}`).join('\n') || 'لا توجد تشغيلات' };
  },
};

export const githubRelease: Tool = {
  schema: {
    name: 'github_release', description: 'إنشاء إصدار (release) جديد.',
    permission: 'github', minLevel: 'write',
    parameters: {
      type: 'object',
      properties: {
        repo: { type: 'string', description: 'owner/repo' },
        tag: { type: 'string', description: 'اسم الوسم' },
        name: { type: 'string', description: 'عنوان الإصدار' },
        body: { type: 'string', description: 'ملاحظات الإصدار' },
        prerelease: { type: 'boolean', description: 'إصدار تجريبي' },
      },
      required: ['repo', 'tag'],
    },
  },
  async handler(args, ctx) {
    const r = await call<any>(ctx, `/repos/${requireArg(args, 'repo')}/releases`, {
      method: 'POST',
      body: JSON.stringify({ tag_name: requireArg(args, 'tag'), name: str(args, 'name', str(args, 'tag')), body: str(args, 'body'), prerelease: bool(args, 'prerelease') }),
    });
    return { ok: true, output: `تم إنشاء الإصدار: ${r.html_url}` };
  },
};

export const githubDeleteRepo: Tool = {
  schema: {
    name: 'github_delete_repo', description: 'حذف مستودع نهائيًا (خطير جدًا — يتطلب موافقة صريحة).',
    permission: 'github', minLevel: 'admin', destructive: true,
    parameters: { type: 'object', properties: { repo: { type: 'string', description: 'owner/repo' } }, required: ['repo'] },
  },
  async handler(args, ctx) {
    await call(ctx, `/repos/${requireArg(args, 'repo')}`, { method: 'DELETE' });
    return { ok: true, output: `تم حذف المستودع ${str(args, 'repo')}` };
  },
};

export const GITHUB_TOOLS: Tool[] = [
  githubListRepos, githubReadFile, githubWriteFile, githubCreateBranch,
  githubCreatePR, githubIssues, githubActions, githubRelease, githubDeleteRepo,
];
