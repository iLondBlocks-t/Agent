import { describe, expect, it } from 'vitest';
import { checkPermission, isDestructive, levelAtLeast } from './permissions';
import { AGENT_PRESETS, agentFromPreset } from '../agents/presets';
import { TOOL_MAP } from '../tools/registry';
import type { Agent } from '@/types';

const coder: Agent = agentFromPreset(AGENT_PRESETS.find((p) => p.role === 'coder')!, 'p1', 'm1', 'coder1');
const devops: Agent = agentFromPreset(AGENT_PRESETS.find((p) => p.role === 'devops')!, 'p1', 'm1', 'dev1');

describe('levelAtLeast', () => {
  it('orders levels', () => {
    expect(levelAtLeast('admin', 'write')).toBe(true);
    expect(levelAtLeast('read', 'write')).toBe(false);
    expect(levelAtLeast('off', 'read')).toBe(false);
  });
});

describe('isDestructive', () => {
  it('flags destructive tool schemas', () => {
    expect(isDestructive(TOOL_MAP.github_delete_repo.schema, {})).toBe(true);
  });
  it('flags destructive arguments', () => {
    expect(isDestructive(TOOL_MAP.terminal_run.schema, { command: 'git push --force' })).toBe(true);
  });
  it('allows safe arguments', () => {
    expect(isDestructive(TOOL_MAP.terminal_run.schema, { command: 'npm test' })).toBe(false);
  });
});

describe('checkPermission', () => {
  it('allows a permitted tool', () => {
    const d = checkPermission(coder, TOOL_MAP.file_write.schema, { path: 'a.ts', content: 'x' });
    expect(d.allowed).toBe(true);
    expect(d.needsApproval).toBe(false);
  });

  it('denies a tool not in allowedTools', () => {
    const d = checkPermission(coder, TOOL_MAP.discord_send_message.schema, {});
    expect(d.allowed).toBe(false);
  });

  it('denies when permission level is too low', () => {
    const limited = { ...coder, permissions: { ...coder.permissions, files: 'read' as const } };
    expect(checkPermission(limited, TOOL_MAP.file_write.schema, {}).allowed).toBe(false);
  });

  it('blocks everything with the kill switch', () => {
    const d = checkPermission(coder, TOOL_MAP.file_read.schema, {}, { killSwitch: true });
    expect(d.allowed).toBe(false);
    expect(d.risk).toBe('high');
  });

  it('denies over the daily spend limit', () => {
    const d = checkPermission(coder, TOOL_MAP.file_read.schema, {}, { spentTodayUsd: 999 });
    expect(d.allowed).toBe(false);
  });

  it('denies disabled agents', () => {
    expect(checkPermission({ ...coder, enabled: false }, TOOL_MAP.file_read.schema, {}).allowed).toBe(false);
  });

  it('requires approval for destructive actions', () => {
    const admin = { ...devops, allowedTools: [...devops.allowedTools, 'github_delete_repo'] };
    const d = checkPermission(admin, TOOL_MAP.github_delete_repo.schema, { repo: 'a/b' });
    expect(d.allowed).toBe(true);
    expect(d.needsApproval).toBe(true);
    expect(d.risk).toBe('high');
  });
});
