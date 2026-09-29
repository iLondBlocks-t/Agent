import { LEVEL_ORDER, type Agent, type PermissionKey, type PermissionLevel, type ToolSchema } from '@/types';

export interface PermissionDecision {
  allowed: boolean;
  needsApproval: boolean;
  reason: string;
  risk: 'low' | 'medium' | 'high';
}

export const DESTRUCTIVE_HINTS = ['delete', 'destroy', 'force', 'purge', 'drop', 'rm -rf', 'wipe'];

export function levelAtLeast(actual: PermissionLevel, required: PermissionLevel): boolean {
  return LEVEL_ORDER[actual] >= LEVEL_ORDER[required];
}

export function isDestructive(tool: ToolSchema, args: Record<string, unknown>): boolean {
  if (tool.destructive) return true;
  const blob = JSON.stringify(args ?? {}).toLowerCase();
  return DESTRUCTIVE_HINTS.some((h) => blob.includes(h));
}

export function checkPermission(
  agent: Agent,
  tool: ToolSchema,
  args: Record<string, unknown>,
  opts: { killSwitch?: boolean; spentTodayUsd?: number } = {},
): PermissionDecision {
  if (opts.killSwitch) {
    return { allowed: false, needsApproval: false, reason: 'مفتاح الإيقاف العام مفعّل', risk: 'high' };
  }
  if (!agent.enabled) {
    return { allowed: false, needsApproval: false, reason: 'الوكيل معطّل', risk: 'low' };
  }
  if (!agent.allowedTools.includes(tool.name)) {
    return { allowed: false, needsApproval: false, reason: `الأداة ${tool.name} غير مسموحة لهذا الوكيل`, risk: 'medium' };
  }
  if ((opts.spentTodayUsd ?? 0) >= agent.dailySpendLimitUsd) {
    return { allowed: false, needsApproval: false, reason: 'تم تجاوز حد الإنفاق اليومي', risk: 'medium' };
  }
  const key = tool.permission as Exclude<PermissionKey, 'none'>;
  if (tool.permission !== 'none') {
    const granted = agent.permissions[key] ?? 'off';
    if (granted === 'off') {
      return { allowed: false, needsApproval: false, reason: `صلاحية ${key} مغلقة`, risk: 'medium' };
    }
    if (!levelAtLeast(granted, tool.minLevel)) {
      return { allowed: false, needsApproval: false, reason: `تحتاج صلاحية ${key}=${tool.minLevel} والممنوح ${granted}`, risk: 'medium' };
    }
  }
  if (isDestructive(tool, args)) {
    return { allowed: true, needsApproval: true, reason: 'إجراء مدمّر يتطلب موافقتك الصريحة', risk: 'high' };
  }
  const risk: 'low' | 'medium' = tool.minLevel === 'read' ? 'low' : 'medium';
  return { allowed: true, needsApproval: false, reason: 'مسموح', risk };
}
