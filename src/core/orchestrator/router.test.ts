import { describe, expect, it } from 'vitest';
import { detectRole, fallbackChain, routeTask } from './router';
import { AGENT_PRESETS, agentFromPreset } from '../agents/presets';
import type { Agent } from '@/types';

const agents: Agent[] = AGENT_PRESETS.map((p, i) => agentFromPreset(p, 'prov1', 'model-x', `a${i}`));

describe('detectRole', () => {
  it('detects coding tasks', () => expect(detectRole('اكتب كود لدالة تسجيل الدخول')).toBe('coder'));
  it('detects research tasks', () => expect(detectRole('ابحث عن أفضل مكتبة')).toBe('researcher'));
  it('detects devops tasks', () => expect(detectRole('افتح pull request على github')).toBe('devops'));
  it('detects discord tasks', () => expect(detectRole('أرسل رسالة على discord')).toBe('discord'));
  it('defaults to coder', () => expect(detectRole('شيء عام جدًا')).toBe('coder'));
});

describe('routeTask', () => {
  it('returns null with no agents', () => {
    expect(routeTask({ description: 'x', agents: [] })).toBeNull();
  });

  it('picks the matching role', () => {
    const r = routeTask({ description: 'اكتب اختبار وحدة unit test', agents });
    expect(r?.agent.role).toBe('tester');
  });

  it('respects explicit preferredRole', () => {
    const r = routeTask({ description: 'أي شيء', agents, preferredRole: 'writer' });
    expect(r?.agent.role).toBe('writer');
  });

  it('skips agents over their spend limit', () => {
    const spent: Record<string, number> = {};
    const writer = agents.find((a) => a.role === 'writer')!;
    spent[writer.id] = writer.dailySpendLimitUsd + 1;
    const r = routeTask({ description: 'اكتب توثيق readme', agents, spentToday: spent });
    expect(r?.agent.id).not.toBe(writer.id);
  });

  it('skips disabled agents', () => {
    const list = agents.map((a) => ({ ...a, enabled: a.role !== 'coder' }));
    const r = routeTask({ description: 'اكتب كود', agents: list });
    expect(r?.agent.role).not.toBe('coder');
  });

  it('prefers cheap+fast agents for the cost objective', () => {
    const two: Agent[] = [
      { ...agents[0], id: 'cheap', role: 'custom', quality: 0.6, speed: 0.9, costFactor: 0.1 },
      { ...agents[0], id: 'pricey', role: 'custom', quality: 0.95, speed: 0.3, costFactor: 0.95 },
    ];
    expect(routeTask({ description: 'مهمة', agents: two, objective: 'cost' })?.agent.id).toBe('cheap');
    expect(routeTask({ description: 'مهمة', agents: two, objective: 'quality' })?.agent.id).toBe('pricey');
  });
});

describe('fallbackChain', () => {
  it('returns distinct ordered agents', () => {
    const chain = fallbackChain({ description: 'اكتب كود', agents }, 3);
    expect(chain).toHaveLength(3);
    expect(new Set(chain.map((a) => a.id)).size).toBe(3);
  });

  it('is bounded by the number of agents', () => {
    const chain = fallbackChain({ description: 'x', agents: agents.slice(0, 2) }, 5);
    expect(chain.length).toBeLessThanOrEqual(2);
  });
});
