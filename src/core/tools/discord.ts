import { httpJson, withRetry } from '../providers/http';
import { wrapUntrusted } from '../security/sanitize';
import type { Tool, ToolContext } from './types';
import { num, requireArg, str } from './types';

const API = 'https://discord.com/api/v10';

function headers(ctx: ToolContext) {
  const token = ctx.settings.discordBotToken?.trim();
  if (!token) throw new Error('لم يتم ضبط رمز بوت Discord في الإعدادات');
  return { Authorization: `Bot ${token}`, 'Content-Type': 'application/json' };
}

async function call<T = any>(ctx: ToolContext, path: string, init: RequestInit = {}): Promise<T> {
  return withRetry(() => httpJson<T>(`${API}${path}`, { ...init, headers: headers(ctx), signal: ctx.signal }), { signal: ctx.signal });
}

export const discordReadMessages: Tool = {
  schema: {
    name: 'discord_read_messages', description: 'قراءة آخر الرسائل في قناة Discord.',
    permission: 'discord', minLevel: 'read',
    parameters: {
      type: 'object',
      properties: { channel_id: { type: 'string', description: 'معرّف القناة' }, limit: { type: 'number', description: 'عدد الرسائل (افتراضي 20)' } },
      required: ['channel_id'],
    },
  },
  async handler(args, ctx) {
    const list = await call<any[]>(ctx, `/channels/${requireArg(args, 'channel_id')}/messages?limit=${Math.min(100, num(args, 'limit', 20))}`);
    const text = list.map((m) => `${m.author?.username}: ${m.content}`).reverse().join('\n');
    return { ok: true, output: wrapUntrusted('discord:messages', text || 'لا توجد رسائل') };
  },
};

export const discordSendMessage: Tool = {
  schema: {
    name: 'discord_send_message', description: 'إرسال رسالة إلى قناة Discord.',
    permission: 'discord', minLevel: 'write',
    parameters: {
      type: 'object',
      properties: { channel_id: { type: 'string', description: 'معرّف القناة' }, content: { type: 'string', description: 'نص الرسالة' } },
      required: ['channel_id', 'content'],
    },
  },
  async handler(args, ctx) {
    const m = await call<any>(ctx, `/channels/${requireArg(args, 'channel_id')}/messages`, {
      method: 'POST', body: JSON.stringify({ content: requireArg(args, 'content').slice(0, 1900) }),
    });
    return { ok: true, output: `تم الإرسال (id=${m.id})` };
  },
};

export const discordListChannels: Tool = {
  schema: {
    name: 'discord_list_channels', description: 'سرد قنوات سيرفر Discord.',
    permission: 'discord', minLevel: 'read',
    parameters: { type: 'object', properties: { guild_id: { type: 'string', description: 'معرّف السيرفر' } }, required: ['guild_id'] },
  },
  async handler(args, ctx) {
    const list = await call<any[]>(ctx, `/guilds/${requireArg(args, 'guild_id')}/channels`);
    return { ok: true, output: list.map((c) => `${c.id} — ${c.name} (type=${c.type})`).join('\n') };
  },
};

export const discordRoles: Tool = {
  schema: {
    name: 'discord_roles', description: 'سرد الأدوار أو منح/سحب دور لعضو.',
    permission: 'discord', minLevel: 'admin',
    parameters: {
      type: 'object',
      properties: {
        guild_id: { type: 'string', description: 'معرّف السيرفر' },
        action: { type: 'string', description: 'list | add | remove', enum: ['list', 'add', 'remove'] },
        user_id: { type: 'string', description: 'معرّف العضو' },
        role_id: { type: 'string', description: 'معرّف الدور' },
      },
      required: ['guild_id', 'action'],
    },
  },
  async handler(args, ctx) {
    const g = requireArg(args, 'guild_id');
    const action = str(args, 'action', 'list');
    if (action === 'list') {
      const roles = await call<any[]>(ctx, `/guilds/${g}/roles`);
      return { ok: true, output: roles.map((r) => `${r.id} — ${r.name}`).join('\n') };
    }
    const path = `/guilds/${g}/members/${requireArg(args, 'user_id')}/roles/${requireArg(args, 'role_id')}`;
    await call(ctx, path, { method: action === 'add' ? 'PUT' : 'DELETE' });
    return { ok: true, output: `تم ${action === 'add' ? 'منح' : 'سحب'} الدور` };
  },
};

export const discordWebhook: Tool = {
  schema: {
    name: 'discord_webhook', description: 'إرسال رسالة عبر Webhook (بدون رمز بوت).',
    permission: 'discord', minLevel: 'write',
    parameters: {
      type: 'object',
      properties: { url: { type: 'string', description: 'رابط الـ webhook' }, content: { type: 'string', description: 'النص' } },
      required: ['url', 'content'],
    },
  },
  async handler(args, ctx) {
    const url = requireArg(args, 'url');
    if (!/^https:\/\/(discord\.com|discordapp\.com)\/api\/webhooks\//.test(url)) throw new Error('رابط webhook غير صالح');
    await httpJson(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ content: requireArg(args, 'content').slice(0, 1900) }), signal: ctx.signal });
    return { ok: true, output: 'تم الإرسال عبر الـ webhook' };
  },
};

export const discordSlashCommand: Tool = {
  schema: {
    name: 'discord_register_command', description: 'تسجيل أمر Slash للتطبيق/البوت.',
    permission: 'discord', minLevel: 'admin',
    parameters: {
      type: 'object',
      properties: {
        application_id: { type: 'string', description: 'معرّف التطبيق' },
        guild_id: { type: 'string', description: 'معرّف السيرفر (اختياري لأمر عام)' },
        name: { type: 'string', description: 'اسم الأمر' },
        description: { type: 'string', description: 'وصف الأمر' },
      },
      required: ['application_id', 'name', 'description'],
    },
  },
  async handler(args, ctx) {
    const app = requireArg(args, 'application_id');
    const guild = str(args, 'guild_id');
    const path = guild ? `/applications/${app}/guilds/${guild}/commands` : `/applications/${app}/commands`;
    const c = await call<any>(ctx, path, { method: 'POST', body: JSON.stringify({ name: requireArg(args, 'name'), description: requireArg(args, 'description'), type: 1 }) });
    return { ok: true, output: `تم تسجيل الأمر /${c.name}` };
  },
};

export const DISCORD_TOOLS: Tool[] = [
  discordReadMessages, discordSendMessage, discordListChannels, discordRoles, discordWebhook, discordSlashCommand,
];
