import type { ToolSchema } from '@/types';
import { DISCORD_TOOLS } from './discord';
import { FILE_TOOLS } from './files';
import { GITHUB_TOOLS } from './github';
import { TERMINAL_TOOLS } from './terminal';
import type { Tool } from './types';
import { WEB_TOOLS } from './web';

/** All tools. Add a tool = schema + handler + required permission, then list it here. */
export const ALL_TOOLS: Tool[] = [...FILE_TOOLS, ...GITHUB_TOOLS, ...DISCORD_TOOLS, ...TERMINAL_TOOLS, ...WEB_TOOLS];

export const TOOL_MAP: Record<string, Tool> = Object.fromEntries(ALL_TOOLS.map((t) => [t.schema.name, t]));

export function getTool(name: string): Tool | undefined { return TOOL_MAP[name]; }

export function schemasFor(names: string[]): ToolSchema[] {
  return names.map((n) => TOOL_MAP[n]?.schema).filter(Boolean) as ToolSchema[];
}

export const TOOL_GROUPS: { key: string; label: string; tools: Tool[] }[] = [
  { key: 'files', label: 'الملفات', tools: FILE_TOOLS },
  { key: 'github', label: 'GitHub', tools: GITHUB_TOOLS },
  { key: 'discord', label: 'Discord', tools: DISCORD_TOOLS },
  { key: 'terminal', label: 'الطرفية', tools: TERMINAL_TOOLS },
  { key: 'web', label: 'الويب', tools: WEB_TOOLS },
];
