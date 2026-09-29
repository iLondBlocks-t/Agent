import { zipSync, strToU8 } from 'fflate';
import { Filesystem, Directory, Encoding } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import { Capacitor } from '@capacitor/core';
import type { Tool, ToolContext, ToolResult } from './types';
import { requireArg, str } from './types';
import { wrapUntrusted } from '../security/sanitize';

function normalize(p: string): string {
  const clean = p.replace(/\\/g, '/').replace(/^\/+/, '').replace(/\.\.(\/|$)/g, '');
  if (!clean) throw new Error('مسار غير صالح');
  return clean;
}

export const fileWrite: Tool = {
  schema: {
    name: 'file_write',
    description: 'إنشاء أو استبدال ملف داخل مساحة العمل المعزولة للمشروع.',
    permission: 'files', minLevel: 'write',
    parameters: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'مسار نسبي مثل src/index.ts' },
        content: { type: 'string', description: 'محتوى الملف الكامل' },
      },
      required: ['path', 'content'],
    },
  },
  async handler(args, ctx): Promise<ToolResult> {
    const path = normalize(requireArg(args, 'path'));
    const content = str(args, 'content');
    ctx.files.write(path, content);
    return { ok: true, output: `تم حفظ ${path} (${content.length} حرف)` };
  },
};

export const fileRead: Tool = {
  schema: {
    name: 'file_read',
    description: 'قراءة محتوى ملف من مساحة العمل.',
    permission: 'files', minLevel: 'read',
    parameters: { type: 'object', properties: { path: { type: 'string', description: 'المسار النسبي' } }, required: ['path'] },
  },
  async handler(args, ctx) {
    const path = normalize(requireArg(args, 'path'));
    const content = ctx.files.read(path);
    if (content === null) return { ok: false, output: `الملف غير موجود: ${path}` };
    return { ok: true, output: wrapUntrusted(`file:${path}`, content) };
  },
};

export const fileList: Tool = {
  schema: {
    name: 'file_list',
    description: 'سرد كل ملفات مساحة العمل مع أحجامها.',
    permission: 'files', minLevel: 'read',
    parameters: { type: 'object', properties: {}, required: [] },
  },
  async handler(_a, ctx) {
    const files = ctx.files.list();
    if (!files.length) return { ok: true, output: 'مساحة العمل فارغة' };
    return { ok: true, output: files.map((f) => `${f.path} (${f.content.length}B)`).join('\n'), data: files };
  },
};

export const fileEdit: Tool = {
  schema: {
    name: 'file_edit',
    description: 'تعديل ملف باستبدال نص موجود بنص جديد (أول تطابق).',
    permission: 'files', minLevel: 'write',
    parameters: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'المسار' },
        find: { type: 'string', description: 'النص المطلوب استبداله' },
        replace: { type: 'string', description: 'النص الجديد' },
      },
      required: ['path', 'find', 'replace'],
    },
  },
  async handler(args, ctx) {
    const path = normalize(requireArg(args, 'path'));
    const current = ctx.files.read(path);
    if (current === null) return { ok: false, output: `الملف غير موجود: ${path}` };
    const find = requireArg(args, 'find');
    if (!current.includes(find)) return { ok: false, output: 'لم يتم العثور على النص المطلوب' };
    ctx.files.write(path, current.replace(find, str(args, 'replace')));
    return { ok: true, output: `تم تعديل ${path}` };
  },
};

export const fileDelete: Tool = {
  schema: {
    name: 'file_delete',
    description: 'حذف ملف من مساحة العمل (إجراء مدمّر يتطلب موافقة).',
    permission: 'files', minLevel: 'write', destructive: true,
    parameters: { type: 'object', properties: { path: { type: 'string', description: 'المسار' } }, required: ['path'] },
  },
  async handler(args, ctx) {
    const path = normalize(requireArg(args, 'path'));
    ctx.files.remove(path);
    return { ok: true, output: `تم حذف ${path}` };
  },
};

export async function exportZip(files: { path: string; content: string }[], name = 'project'): Promise<{ path: string; base64: string }> {
  const entries: Record<string, Uint8Array> = {};
  for (const f of files) entries[f.path] = strToU8(f.content);
  if (!files.length) entries['README.txt'] = strToU8('مساحة العمل فارغة');
  const zipped = zipSync(entries, { level: 6 });
  let bin = '';
  const chunk = 0x8000;
  for (let i = 0; i < zipped.length; i += chunk) bin += String.fromCharCode(...zipped.subarray(i, i + chunk));
  const base64 = btoa(bin);
  const fileName = `${name}-${Date.now()}.zip`;

  if (Capacitor.isNativePlatform()) {
    const res = await Filesystem.writeFile({ path: fileName, data: base64, directory: Directory.Documents, recursive: true });
    try { await Share.share({ title: fileName, url: res.uri, dialogTitle: 'مشاركة/حفظ ملف المشروع' }); } catch { /* user cancelled */ }
    return { path: res.uri, base64 };
  }
  const blob = new Blob([zipped.slice().buffer as ArrayBuffer], { type: 'application/zip' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = fileName; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
  return { path: fileName, base64 };
}

export const fileExportZip: Tool = {
  schema: {
    name: 'file_export_zip',
    description: 'تصدير كل ملفات مساحة العمل كملف ZIP وحفظه/مشاركته.',
    permission: 'files', minLevel: 'write',
    parameters: { type: 'object', properties: { name: { type: 'string', description: 'اسم الملف بدون امتداد' } }, required: [] },
  },
  async handler(args, ctx) {
    const res = await exportZip(ctx.files.list(), str(args, 'name', 'project'));
    return { ok: true, output: `تم تصدير المشروع إلى ${res.path}` };
  },
};

export async function saveTextToDownloads(name: string, content: string): Promise<string> {
  if (Capacitor.isNativePlatform()) {
    const res = await Filesystem.writeFile({ path: name, data: content, directory: Directory.Documents, encoding: Encoding.UTF8, recursive: true });
    return res.uri;
  }
  const blob = new Blob([content], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
  return name;
}

export const FILE_TOOLS: Tool[] = [fileWrite, fileRead, fileList, fileEdit, fileDelete, fileExportZip];
export type { ToolContext };
