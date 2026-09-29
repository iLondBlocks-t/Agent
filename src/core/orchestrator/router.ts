import type { Agent, AgentRole } from '@/types';

export type Objective = 'quality' | 'speed' | 'cost' | 'balanced';

export interface RouteInput {
  description: string;
  agents: Agent[];
  objective?: Objective;
  preferredRole?: AgentRole;
  spentToday?: Record<string, number>;
  excludeAgentIds?: string[];
}

export interface RouteResult { agent: Agent; score: number; reason: string; }

const ROLE_KEYWORDS: Record<AgentRole, string[]> = {
  planner: ['خطة', 'خطط', 'تحليل', 'تقسيم', 'plan', 'breakdown', 'architecture', 'معمارية'],
  coder: ['كود', 'برمج', 'implement', 'code', 'function', 'ملف', 'component', 'api', 'باگ', 'refactor'],
  reviewer: ['مراجعة', 'review', 'debug', 'خطأ', 'bug', 'fix', 'إصلاح', 'تدقيق'],
  devops: ['github', 'ci', 'workflow', 'deploy', 'نشر', 'release', 'إصدار', 'branch', 'pr', 'pull request', 'actions'],
  researcher: ['ابحث', 'بحث', 'research', 'search', 'مصادر', 'قارن', 'compare', 'اقرأ'],
  designer: ['تصميم', 'design', 'ui', 'ux', 'واجهة', 'ألوان', 'theme', 'style'],
  tester: ['اختبار', 'test', 'unit', 'qa', 'تحقق', 'coverage'],
  writer: ['اكتب', 'توثيق', 'readme', 'docs', 'documentation', 'مقال', 'محتوى'],
  discord: ['discord', 'ديسكورد', 'قناة', 'رسالة', 'بوت', 'روم'],
  custom: [],
};

export function detectRole(description: string): AgentRole {
  const t = description.toLowerCase();
  let best: AgentRole = 'coder';
  let bestHits = 0;
  (Object.keys(ROLE_KEYWORDS) as AgentRole[]).forEach((role) => {
    const hits = ROLE_KEYWORDS[role].reduce((n, k) => (t.includes(k) ? n + 1 : n), 0);
    if (hits > bestHits) { bestHits = hits; best = role; }
  });
  return bestHits === 0 ? 'coder' : best;
}

const WEIGHTS: Record<Objective, { q: number; s: number; c: number }> = {
  quality: { q: 0.7, s: 0.1, c: 0.2 },
  speed: { q: 0.2, s: 0.65, c: 0.15 },
  cost: { q: 0.2, s: 0.15, c: 0.65 },
  balanced: { q: 0.45, s: 0.25, c: 0.3 },
};

/** Picks the best agent for a subtask based on role fit, quality, speed and cost. */
export function routeTask(input: RouteInput): RouteResult | null {
  const objective = input.objective ?? 'balanced';
  const w = WEIGHTS[objective];
  const role = input.preferredRole ?? detectRole(input.description);
  const exclude = new Set(input.excludeAgentIds ?? []);

  const candidates = input.agents.filter((a) => {
    if (!a.enabled || exclude.has(a.id)) return false;
    const spent = input.spentToday?.[a.id] ?? 0;
    return spent < a.dailySpendLimitUsd;
  });
  if (!candidates.length) return null;

  let best: RouteResult | null = null;
  for (const a of candidates) {
    const roleFit = a.role === role ? 1 : a.role === 'custom' ? 0.55 : 0.25;
    const score = roleFit * 0.5 + (w.q * a.quality + w.s * a.speed + w.c * (1 - a.costFactor)) * 0.5;
    if (!best || score > best.score) {
      best = { agent: a, score, reason: `دور مطلوب: ${role} — تطابق ${(roleFit * 100).toFixed(0)}% ، هدف: ${objective}` };
    }
  }
  return best;
}

/** Ordered fallback chain: preferred agent first, then other capable agents. */
export function fallbackChain(input: RouteInput, limit = 3): Agent[] {
  const chain: Agent[] = [];
  const excluded = new Set(input.excludeAgentIds ?? []);
  for (let i = 0; i < limit; i++) {
    const r = routeTask({ ...input, excludeAgentIds: [...excluded] });
    if (!r) break;
    chain.push(r.agent);
    excluded.add(r.agent.id);
  }
  return chain;
}
