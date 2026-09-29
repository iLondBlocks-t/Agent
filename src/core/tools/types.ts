import type { Settings, ToolSchema } from '@/types';

export interface WorkspaceFile { path: string; content: string; updatedAt: number; }

export interface ToolContext {
  settings: Settings;
  agentId: string;
  runId: string;
  files: {
    list(): WorkspaceFile[];
    read(path: string): string | null;
    write(path: string, content: string): void;
    remove(path: string): void;
  };
  log(message: string): void;
  signal?: AbortSignal;
}

export interface ToolResult { ok: boolean; output: string; data?: unknown; }

export interface Tool {
  schema: ToolSchema;
  handler(args: Record<string, unknown>, ctx: ToolContext): Promise<ToolResult>;
}

export function str(args: Record<string, unknown>, key: string, def = ''): string {
  const v = args[key];
  return v === undefined || v === null ? def : String(v);
}
export function num(args: Record<string, unknown>, key: string, def = 0): number {
  const v = Number(args[key]);
  return Number.isFinite(v) ? v : def;
}
export function bool(args: Record<string, unknown>, key: string, def = false): boolean {
  const v = args[key];
  if (typeof v === 'boolean') return v;
  if (typeof v === 'string') return v.toLowerCase() === 'true';
  return def;
}
export function requireArg(args: Record<string, unknown>, key: string): string {
  const v = str(args, key).trim();
  if (!v) throw new Error(`المعامل المطلوب "${key}" مفقود`);
  return v;
}
