import type {
  Agent, ApprovalRequest, ChatMessage, Provider, ProviderConfig, Run, RunMode, Settings, TaskNode, TaskStatus, Usage,
} from '@/types';
import { createProvider } from '../providers/registry';
import { checkPermission } from '../security/permissions';
import { globalLimiter } from '../security/rateLimit';
import { redactSecrets } from '../security/sanitize';
import { getTool, schemasFor } from '../tools/registry';
import type { ToolContext, WorkspaceFile } from '../tools/types';
import { ProjectMemory } from './memory';
import { fallbackChain, routeTask } from './router';

export interface EngineHost {
  getSettings(): Settings;
  getAgents(): Agent[];
  getProviders(): ProviderConfig[];
  getSpentToday(): Record<string, number>;
  files: {
    list(): WorkspaceFile[];
    read(path: string): string | null;
    write(path: string, content: string): void;
    remove(path: string): void;
  };
  onRunUpdate(run: Run): void;
  onNodeUpdate(runId: string, node: TaskNode): void;
  onStream(runId: string, nodeId: string, chunk: string): void;
  onAudit(entry: { agentId: string; tool: string; action: string; allowed: boolean; detail: string }): void;
  onSpend(agentId: string, usd: number): void;
  requestApproval(req: Omit<ApprovalRequest, 'id' | 'createdAt'>): Promise<boolean>;
  notify(title: string, body: string): void;
}

const ZERO: Usage = { promptTokens: 0, completionTokens: 0, totalTokens: 0, costUsd: 0 };
const addUsage = (a: Usage, b: Usage): Usage => ({
  promptTokens: a.promptTokens + b.promptTokens,
  completionTokens: a.completionTokens + b.completionTokens,
  totalTokens: a.totalTokens + b.totalTokens,
  costUsd: a.costUsd + b.costUsd,
});

export interface PlannedTask { id: string; title: string; description: string; role?: string; dependsOn: string[]; }

export function heuristicPlan(goal: string): PlannedTask[] {
  return [
    { id: 't1', title: 'فهم وتحليل الهدف', description: `حلّل الهدف التالي وحدد المتطلبات والمخرجات: ${goal}`, role: 'planner', dependsOn: [] },
    { id: 't2', title: 'البحث وجمع المعلومات', description: `اجمع المعلومات اللازمة لتنفيذ: ${goal}`, role: 'researcher', dependsOn: ['t1'] },
    { id: 't3', title: 'التنفيذ', description: `نفّذ العمل المطلوب واكتب كل الملفات في مساحة العمل: ${goal}`, role: 'coder', dependsOn: ['t1', 't2'] },
    { id: 't4', title: 'المراجعة والإصلاح', description: 'راجع المخرجات، اكتشف الأخطاء وأصلحها مباشرة عبر الأدوات.', role: 'reviewer', dependsOn: ['t3'] },
    { id: 't5', title: 'التسليم والتوثيق', description: 'اكتب ملخص التسليم وملف README داخل مساحة العمل.', role: 'writer', dependsOn: ['t4'] },
  ];
}

function parsePlan(text: string): PlannedTask[] | null {
  const match = text.match(/\[[\s\S]*\]/);
  if (!match) return null;
  try {
    const arr = JSON.parse(match[0]);
    if (!Array.isArray(arr) || !arr.length) return null;
    return arr.slice(0, 12).map((t: any, i: number) => ({
      id: String(t.id ?? `t${i + 1}`),
      title: String(t.title ?? `مهمة ${i + 1}`).slice(0, 120),
      description: String(t.description ?? t.title ?? '').slice(0, 2000),
      role: t.role ? String(t.role) : undefined,
      dependsOn: Array.isArray(t.dependsOn) ? t.dependsOn.map(String) : [],
    }));
  } catch { return null; }
}

export class OrchestratorEngine {
  private aborter = new AbortController();
  private paused = false;
  private memory = new ProjectMemory();

  constructor(private host: EngineHost) {}

  cancel(): void { this.aborter.abort(); }
  pause(): void { this.paused = true; }
  resume(): void { this.paused = false; }
  get signal(): AbortSignal { return this.aborter.signal; }

  private async waitIfPaused(): Promise<void> {
    while (this.paused && !this.aborter.signal.aborted) {
      await new Promise((r) => setTimeout(r, 400));
    }
    if (this.aborter.signal.aborted) throw new Error('تم إلغاء المهمة');
  }

  private providerFor(agent: Agent, useFallback = false): { provider: Provider; model: string } | null {
    const cfgs = this.host.getProviders();
    const id = useFallback ? agent.fallbackProviderId ?? agent.providerId : agent.providerId;
    const model = useFallback ? agent.fallbackModel ?? agent.model : agent.model;
    const cfg = cfgs.find((p) => p.id === id && p.enabled);
    if (!cfg || !model) return null;
    return { provider: createProvider(cfg), model };
  }

  async plan(goal: string, planner: Agent | null): Promise<PlannedTask[]> {
    if (!planner) return heuristicPlan(goal);
    const pm = this.providerFor(planner);
    if (!pm) return heuristicPlan(goal);
    const messages: ChatMessage[] = [
      {
        role: 'system',
        content: `${planner.systemPrompt}\n\nأخرج خطة على شكل JSON فقط: مصفوفة من العناصر بالحقول id, title, description, role, dependsOn.
القيم المسموحة لـ role: planner, researcher, coder, reviewer, devops, designer, tester, writer, discord.
بحد أقصى 8 مهام. لا تكتب أي نص خارج الـ JSON.`,
      },
      { role: 'user', content: `الهدف: ${goal}` },
    ];
    try {
      const res = await pm.provider.chat({ model: pm.model, messages, temperature: 0.2, maxTokens: 1800, signal: this.aborter.signal });
      return parsePlan(res.content) ?? heuristicPlan(goal);
    } catch {
      return heuristicPlan(goal);
    }
  }

  /** Full pipeline: Understand → Plan → Delegate → Execute → Review → Fix → Deliver */
  async run(run: Run, opts: { mode: RunMode; onPlan?: (nodes: TaskNode[]) => void } = { mode: 'auto' }): Promise<Run> {
    const agents = this.host.getAgents().filter((a) => a.enabled);
    const settings = this.host.getSettings();
    if (settings.killSwitch) {
      run.status = 'failed';
      run.nodes.forEach((n) => { if (n.status === 'pending') n.status = 'cancelled'; });
      this.host.onRunUpdate(run);
      return run;
    }

    let current: Run = { ...run, status: 'running', updatedAt: Date.now() };
    this.memory = new ProjectMemory(run.memory.map((t) => ({ id: crypto.randomUUID(), ts: Date.now(), scope: 'project' as const, text: t })));
    this.memory.add(`الهدف: ${run.goal}`, 'long');

    if (!current.nodes.length) {
      const planner = agents.find((a) => a.role === 'planner') ?? null;
      const planned = await this.plan(current.goal, planner);
      current.nodes = planned.map((p) => {
        const routed = routeTask({ description: `${p.title} ${p.description}`, agents, preferredRole: p.role as any, spentToday: this.host.getSpentToday() });
        return {
          id: p.id, title: p.title, description: p.description,
          agentId: routed?.agent.id, dependsOn: p.dependsOn,
          status: 'pending' as TaskStatus, usage: { ...ZERO }, logs: routed ? [`الموجّه اختار: ${routed.agent.name} — ${routed.reason}`] : ['لا يوجد وكيل مناسب'],
        };
      });
      opts.onPlan?.(current.nodes);
      this.host.onRunUpdate(current);
    }

    const maxParallel = Math.max(1, Math.min(4, settings.maxParallel || 2));
    const done = new Set(current.nodes.filter((n) => n.status === 'done').map((n) => n.id));

    try {
      for (;;) {
        await this.waitIfPaused();
        const ready = current.nodes.filter(
          (n) => (n.status === 'pending' || n.status === 'paused') && n.dependsOn.every((d) => done.has(d)),
        );
        const remaining = current.nodes.some((n) => n.status === 'pending' || n.status === 'running');
        if (!ready.length) {
          if (!remaining) break;
          // Circular / unmet dependency: unblock by ignoring unmet deps.
          const stuck = current.nodes.filter((n) => n.status === 'pending');
          if (!stuck.length) break;
          stuck.forEach((n) => { n.dependsOn = n.dependsOn.filter((d) => done.has(d)); });
          continue;
        }

        const batch = ready.slice(0, maxParallel);
        await Promise.all(batch.map(async (node) => {
          await this.executeNode(current, node, agents, opts.mode);
          if (node.status === 'done') done.add(node.id);
        }));
        current.totalUsage = current.nodes.reduce((acc, n) => addUsage(acc, n.usage), { ...ZERO });
        current.updatedAt = Date.now();
        this.host.onRunUpdate(current);

        if (current.nodes.some((n) => n.status === 'failed')) {
          const fixed = await this.fixLoop(current, agents, opts.mode);
          fixed.forEach((id) => done.add(id));
        }
      }

      current.summary = this.deliver(current);
      current.status = current.nodes.some((n) => n.status === 'failed') ? 'failed' : 'done';
      current.memory = this.memory.all().map((m) => m.text);
      current.updatedAt = Date.now();
      this.host.onRunUpdate(current);
      this.host.notify(
        current.status === 'done' ? 'اكتملت المهمة ✅' : 'انتهت المهمة مع أخطاء ⚠️',
        current.goal.slice(0, 90),
      );
      return current;
    } catch (err) {
      current.status = this.aborter.signal.aborted ? 'cancelled' : 'failed';
      current.nodes.forEach((n) => { if (n.status === 'running' || n.status === 'pending') n.status = 'cancelled'; });
      current.updatedAt = Date.now();
      this.host.onRunUpdate(current);
      if (!this.aborter.signal.aborted) this.host.notify('فشلت المهمة', redactSecrets((err as Error).message));
      return current;
    }
  }

  private async fixLoop(run: Run, agents: Agent[], mode: RunMode, maxRounds = 2): Promise<string[]> {
    const recovered: string[] = [];
    for (let round = 0; round < maxRounds; round++) {
      const failed = run.nodes.filter((n) => n.status === 'failed');
      if (!failed.length) break;
      for (const node of failed) {
        await this.waitIfPaused();
        const reviewer = agents.find((a) => a.role === 'reviewer') ?? agents.find((a) => a.role === 'coder');
        if (!reviewer) break;
        node.status = 'pending';
        node.agentId = reviewer.id;
        node.description = `أصلح الفشل التالي ثم أكمل المهمة الأصلية.\nالمهمة: ${node.title}\nالوصف: ${node.description}\nالخطأ: ${node.error ?? 'غير معروف'}`;
        node.error = undefined;
        await this.executeNode(run, node, agents, mode);
        if ((node.status as TaskStatus) === 'done') recovered.push(node.id);
      }
      this.host.onRunUpdate(run);
    }
    return recovered;
  }

  private deliver(run: Run): string {
    const okNodes = run.nodes.filter((n) => n.status === 'done');
    const files = this.host.files.list();
    return [
      `## التسليم`,
      `الهدف: ${run.goal}`,
      `المهام المكتملة: ${okNodes.length}/${run.nodes.length}`,
      `التكلفة الإجمالية: $${run.totalUsage.costUsd.toFixed(4)} — ${run.totalUsage.totalTokens} توكن`,
      files.length ? `الملفات المنتجة (${files.length}):\n${files.map((f) => `- ${f.path}`).join('\n')}` : 'لم تُنتج ملفات.',
      '',
      okNodes.map((n) => `### ${n.title}\n${(n.output ?? '').slice(0, 1200)}`).join('\n\n'),
    ].join('\n');
  }

  private async executeNode(run: Run, node: TaskNode, agents: Agent[], mode: RunMode): Promise<void> {
    await this.waitIfPaused();
    const settings = this.host.getSettings();
    node.status = 'running';
    node.startedAt = Date.now();
    this.host.onNodeUpdate(run.id, node);

    const chain = node.agentId
      ? [agents.find((a) => a.id === node.agentId)!, ...fallbackChain({ description: node.description, agents, excludeAgentIds: [node.agentId] }, 2)].filter(Boolean)
      : fallbackChain({ description: node.description, agents }, 3);

    if (!chain.length) {
      node.status = 'failed';
      node.error = 'لا يوجد وكيل متاح لتنفيذ هذه المهمة. أضف مزوّدًا ووكيلًا من الإعدادات.';
      node.finishedAt = Date.now();
      this.host.onNodeUpdate(run.id, node);
      return;
    }

    let lastError = '';
    for (const agent of chain) {
      for (const useFallbackModel of [false, true]) {
        const pm = this.providerFor(agent, useFallbackModel);
        if (!pm) continue;
        if (useFallbackModel && !agent.fallbackModel) continue;
        try {
          await globalLimiter.consume(`agent:${agent.id}`);
          const out = await this.runAgentLoop(run, node, agent, pm.provider, pm.model, mode, settings);
          node.output = out;
          node.status = 'done';
          node.finishedAt = Date.now();
          node.agentId = agent.id;
          this.memory.add(`[${agent.name}] ${node.title}: ${out.slice(0, 700)}`);
          const planner = agents.find((a) => a.role === 'planner');
          if (planner) {
            const ppm = this.providerFor(planner);
            if (ppm) await this.memory.summarizeIfNeeded(ppm.provider, ppm.model);
          }
          this.host.onNodeUpdate(run.id, node);
          return;
        } catch (err) {
          lastError = redactSecrets((err as Error).message || 'خطأ غير معروف');
          node.logs.push(`فشل ${agent.name} (${pm.model}): ${lastError}`);
          this.host.onNodeUpdate(run.id, node);
          if (this.aborter.signal.aborted) throw err;
        }
      }
    }
    node.status = 'failed';
    node.error = lastError || 'فشل التنفيذ';
    node.finishedAt = Date.now();
    this.host.onNodeUpdate(run.id, node);
  }

  private async runAgentLoop(
    run: Run, node: TaskNode, agent: Agent, provider: Provider, model: string, mode: RunMode, settings: Settings,
  ): Promise<string> {
    const tools = schemasFor(agent.allowedTools);
    const depOutputs = node.dependsOn
      .map((d) => run.nodes.find((n) => n.id === d))
      .filter((n): n is TaskNode => !!n && !!n.output)
      .map((n) => `نتيجة المهمة "${n.title}":\n${n.output!.slice(0, 2500)}`)
      .join('\n\n');

    const messages: ChatMessage[] = [
      { role: 'system', content: `${agent.systemPrompt}\n\n${this.memory.contextBlock()}` },
      {
        role: 'user',
        content: [
          `الهدف العام للمشروع: ${run.goal}`,
          `مهمتك الآن: ${node.title}`,
          `التفاصيل: ${node.description}`,
          depOutputs ? `\nمخرجات المهام السابقة:\n${depOutputs}` : '',
          '\nنفّذ المهمة بالكامل باستخدام الأدوات المتاحة، ثم اكتب ملخصًا نهائيًا لما أنجزته.',
        ].filter(Boolean).join('\n'),
      },
    ];

    let finalText = '';
    const maxIterations = 8;

    for (let i = 0; i < maxIterations; i++) {
      await this.waitIfPaused();
      const res = await provider.stream(
        { model, messages, temperature: agent.temperature, tools: tools.length ? tools : undefined, signal: this.aborter.signal },
        (chunk) => this.host.onStream(run.id, node.id, chunk),
      );

      node.usage = addUsage(node.usage, res.usage);
      this.host.onSpend(agent.id, res.usage.costUsd);
      this.host.onNodeUpdate(run.id, node);

      if (res.content) finalText = res.content;
      if (!res.toolCalls.length) break;

      messages.push({ role: 'assistant', content: res.content, toolCalls: res.toolCalls });

      for (const call of res.toolCalls) {
        await this.waitIfPaused();
        const tool = getTool(call.name);
        if (!tool) {
          messages.push({ role: 'tool', toolCallId: call.id, name: call.name, content: `الأداة ${call.name} غير موجودة.` });
          continue;
        }
        const spent = this.host.getSpentToday()[agent.id] ?? 0;
        const decision = checkPermission(agent, tool.schema, call.arguments, { killSwitch: settings.killSwitch, spentTodayUsd: spent });
        if (!decision.allowed) {
          this.host.onAudit({ agentId: agent.id, tool: call.name, action: 'denied', allowed: false, detail: decision.reason });
          node.logs.push(`🚫 ${call.name}: ${decision.reason}`);
          messages.push({ role: 'tool', toolCallId: call.id, name: call.name, content: `رُفض التنفيذ: ${decision.reason}` });
          this.host.onNodeUpdate(run.id, node);
          continue;
        }

        const needsApproval = decision.needsApproval || mode === 'manual' || (mode === 'semi' && tool.schema.minLevel !== 'read');
        if (needsApproval) {
          node.status = 'blocked';
          this.host.onNodeUpdate(run.id, node);
          this.host.notify('مطلوب موافقتك', `${agent.name} يريد تنفيذ ${call.name}`);
          const approved = await this.host.requestApproval({
            runId: run.id, nodeId: node.id, agentId: agent.id, tool: call.name,
            args: call.arguments, risk: decision.risk, reason: decision.reason,
          });
          node.status = 'running';
          this.host.onNodeUpdate(run.id, node);
          if (!approved) {
            this.host.onAudit({ agentId: agent.id, tool: call.name, action: 'rejected', allowed: false, detail: 'رفض المستخدم' });
            messages.push({ role: 'tool', toolCallId: call.id, name: call.name, content: 'رفض المستخدم تنفيذ هذا الإجراء. اقترح بديلاً آمناً.' });
            continue;
          }
        }

        const ctx: ToolContext = {
          settings, agentId: agent.id, runId: run.id, files: this.host.files,
          log: (m) => { node.logs.push(m); this.host.onNodeUpdate(run.id, node); },
          signal: this.aborter.signal,
        };
        try {
          await globalLimiter.consume(`tool:${call.name}`);
          const result = await tool.handler(call.arguments, ctx);
          this.host.onAudit({ agentId: agent.id, tool: call.name, action: 'executed', allowed: true, detail: redactSecrets(result.output.slice(0, 400)) });
          node.logs.push(`${result.ok ? '✅' : '⚠️'} ${call.name}: ${redactSecrets(result.output.slice(0, 250))}`);
          messages.push({ role: 'tool', toolCallId: call.id, name: call.name, content: result.output.slice(0, 20_000) });
        } catch (err) {
          const msg = redactSecrets((err as Error).message);
          this.host.onAudit({ agentId: agent.id, tool: call.name, action: 'error', allowed: true, detail: msg });
          node.logs.push(`❌ ${call.name}: ${msg}`);
          messages.push({ role: 'tool', toolCallId: call.id, name: call.name, content: `خطأ أثناء التنفيذ: ${msg}. صحّح المدخلات وأعد المحاولة أو اختر أداة أخرى.` });
        }
        this.host.onNodeUpdate(run.id, node);
      }
    }

    if (!finalText.trim()) finalText = 'تم تنفيذ الأدوات المطلوبة دون نص ختامي.';
    return finalText;
  }
}
