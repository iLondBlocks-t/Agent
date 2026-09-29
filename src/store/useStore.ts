import { create } from 'zustand';
import type {
  Agent, ApprovalRequest, AuditEntry, ProviderConfig, Run, Settings, TaskNode,
} from '@/types';
import { loadDoc, saveDoc } from '@/core/storage/db';
import { secureGet, secureRemove, secureSet } from '@/core/storage/secure';
import { AGENT_PRESETS, agentFromPreset } from '@/core/agents/presets';
import { OrchestratorEngine } from '@/core/orchestrator/engine';
import type { WorkspaceFile } from '@/core/tools/types';
import { notify, startForeground, stopForeground } from '@/core/platform/native';

export const DEFAULT_SETTINGS: Settings = {
  language: 'ar',
  amoled: false,
  reduceMotion: false,
  killSwitch: false,
  terminalBackendUrl: '',
  terminalBackendToken: '',
  githubToken: '',
  discordBotToken: '',
  searchBackend: 'duckduckgo',
  globalDailyLimitUsd: 10,
  maxParallel: 2,
};

const today = () => new Date().toISOString().slice(0, 10);

interface SpendState { date: string; byAgent: Record<string, number>; }

interface State {
  ready: boolean;
  providers: ProviderConfig[];
  agents: Agent[];
  runs: Run[];
  audit: AuditEntry[];
  approvals: ApprovalRequest[];
  files: WorkspaceFile[];
  settings: Settings;
  spend: SpendState;
  activeRunId: string | null;
  streaming: Record<string, string>;
  engine: OrchestratorEngine | null;

  init(): Promise<void>;
  // providers
  addProvider(p: Omit<ProviderConfig, 'id' | 'createdAt'>): Promise<ProviderConfig>;
  updateProvider(id: string, patch: Partial<ProviderConfig>): Promise<void>;
  deleteProvider(id: string): Promise<void>;
  // agents
  addAgent(a: Omit<Agent, 'id'>): Promise<Agent>;
  updateAgent(id: string, patch: Partial<Agent>): Promise<void>;
  deleteAgent(id: string): Promise<void>;
  seedPresets(providerId: string, model: string): Promise<void>;
  // settings
  updateSettings(patch: Partial<Settings>): Promise<void>;
  // files
  writeFile(path: string, content: string): void;
  deleteFile(path: string): void;
  // runs
  startRun(goal: string, mode: Run['mode']): Promise<string>;
  rerunFrom(runId: string, nodeId: string): Promise<void>;
  pauseRun(): void;
  resumeRun(): void;
  cancelRun(): void;
  deleteRun(id: string): Promise<void>;
  resolveApproval(id: string, approved: boolean): void;
  clearAudit(): Promise<void>;
}

const approvalWaiters = new Map<string, (v: boolean) => void>();

export const useStore = create<State>((set, get) => ({
  ready: false,
  providers: [],
  agents: [],
  runs: [],
  audit: [],
  approvals: [],
  files: [],
  settings: DEFAULT_SETTINGS,
  spend: { date: today(), byAgent: {} },
  activeRunId: null,
  streaming: {},
  engine: null,

  async init() {
    const [providers, agents, runs, audit, files, settings, spend] = await Promise.all([
      loadDoc<ProviderConfig[]>('providers', []),
      loadDoc<Agent[]>('agents', []),
      loadDoc<Run[]>('runs', []),
      loadDoc<AuditEntry[]>('audit', []),
      loadDoc<WorkspaceFile[]>('files', []),
      loadDoc<Settings>('settings', DEFAULT_SETTINGS),
      loadDoc<SpendState>('memory', { date: today(), byAgent: {} }),
    ]);
    // hydrate secrets
    const hydrated = await Promise.all(providers.map(async (p) => ({ ...p, apiKey: (await secureGet(`provider:${p.id}`)) ?? '' })));
    const merged: Settings = { ...DEFAULT_SETTINGS, ...settings };
    merged.githubToken = (await secureGet('settings:github')) ?? '';
    merged.discordBotToken = (await secureGet('settings:discord')) ?? '';
    merged.terminalBackendToken = (await secureGet('settings:terminal')) ?? '';
    set({
      providers: hydrated, agents, runs, audit, files, settings: merged,
      spend: spend.date === today() ? spend : { date: today(), byAgent: {} },
      ready: true,
    });
  },

  async addProvider(p) {
    const cfg: ProviderConfig = { ...p, id: crypto.randomUUID(), createdAt: Date.now() };
    await secureSet(`provider:${cfg.id}`, cfg.apiKey ?? '');
    const list = [...get().providers, cfg];
    set({ providers: list });
    await saveDoc('providers', list.map((x) => ({ ...x, apiKey: '' })));
    return cfg;
  },

  async updateProvider(id, patch) {
    const list = get().providers.map((p) => (p.id === id ? { ...p, ...patch } : p));
    set({ providers: list });
    if (patch.apiKey !== undefined) await secureSet(`provider:${id}`, patch.apiKey ?? '');
    await saveDoc('providers', list.map((x) => ({ ...x, apiKey: '' })));
  },

  async deleteProvider(id) {
    const list = get().providers.filter((p) => p.id !== id);
    set({ providers: list });
    await secureRemove(`provider:${id}`);
    await saveDoc('providers', list.map((x) => ({ ...x, apiKey: '' })));
  },

  async addAgent(a) {
    const agent: Agent = { ...a, id: crypto.randomUUID() };
    const list = [...get().agents, agent];
    set({ agents: list });
    await saveDoc('agents', list);
    return agent;
  },

  async updateAgent(id, patch) {
    const list = get().agents.map((a) => (a.id === id ? { ...a, ...patch } : a));
    set({ agents: list });
    await saveDoc('agents', list);
  },

  async deleteAgent(id) {
    const list = get().agents.filter((a) => a.id !== id);
    set({ agents: list });
    await saveDoc('agents', list);
  },

  async seedPresets(providerId, model) {
    const existing = new Set(get().agents.map((a) => a.role));
    const created = AGENT_PRESETS.filter((p) => !existing.has(p.role)).map((p) => agentFromPreset(p, providerId, model));
    const list = [...get().agents, ...created];
    set({ agents: list });
    await saveDoc('agents', list);
  },

  async updateSettings(patch) {
    const next = { ...get().settings, ...patch };
    set({ settings: next });
    if (patch.githubToken !== undefined) await secureSet('settings:github', patch.githubToken);
    if (patch.discordBotToken !== undefined) await secureSet('settings:discord', patch.discordBotToken);
    if (patch.terminalBackendToken !== undefined) await secureSet('settings:terminal', patch.terminalBackendToken);
    await saveDoc('settings', { ...next, githubToken: '', discordBotToken: '', terminalBackendToken: '' });
  },

  writeFile(path, content) {
    const files = get().files.filter((f) => f.path !== path);
    files.push({ path, content, updatedAt: Date.now() });
    files.sort((a, b) => a.path.localeCompare(b.path));
    set({ files });
    void saveDoc('files', files);
  },

  deleteFile(path) {
    const files = get().files.filter((f) => f.path !== path);
    set({ files });
    void saveDoc('files', files);
  },

  async startRun(goal, mode) {
    const id = crypto.randomUUID();
    const run: Run = {
      id, goal, mode, status: 'running', nodes: [], createdAt: Date.now(), updatedAt: Date.now(),
      totalUsage: { promptTokens: 0, completionTokens: 0, totalTokens: 0, costUsd: 0 }, memory: [],
    };
    const runs = [run, ...get().runs].slice(0, 100);
    set({ runs, activeRunId: id, streaming: {} });
    await saveDoc('runs', runs);

    const persistRuns = () => { void saveDoc('runs', get().runs); };

    const engine = new OrchestratorEngine({
      getSettings: () => get().settings,
      getAgents: () => get().agents,
      getProviders: () => get().providers,
      getSpentToday: () => get().spend.byAgent,
      files: {
        list: () => get().files,
        read: (p) => get().files.find((f) => f.path === p)?.content ?? null,
        write: (p, c) => get().writeFile(p, c),
        remove: (p) => get().deleteFile(p),
      },
      onRunUpdate: (r) => {
        set({ runs: get().runs.map((x) => (x.id === r.id ? { ...r } : x)) });
        persistRuns();
      },
      onNodeUpdate: (runId, node) => {
        set({
          runs: get().runs.map((r) =>
            r.id === runId ? { ...r, nodes: r.nodes.map((n) => (n.id === node.id ? { ...node } : n)) } : r),
        });
      },
      onStream: (runId, nodeId, chunk) => {
        const key = `${runId}:${nodeId}`;
        const prev = get().streaming[key] ?? '';
        set({ streaming: { ...get().streaming, [key]: (prev + chunk).slice(-20_000) } });
      },
      onAudit: (e) => {
        const entry: AuditEntry = { ...e, id: crypto.randomUUID(), ts: Date.now() };
        const audit = [entry, ...get().audit].slice(0, 500);
        set({ audit });
        void saveDoc('audit', audit);
      },
      onSpend: (agentId, usd) => {
        const spend = get().spend.date === today() ? { ...get().spend } : { date: today(), byAgent: {} };
        spend.byAgent = { ...spend.byAgent, [agentId]: (spend.byAgent[agentId] ?? 0) + usd };
        set({ spend });
        void saveDoc('memory', spend);
      },
      requestApproval: (req) => new Promise<boolean>((resolve) => {
        const approval: ApprovalRequest = { ...req, id: crypto.randomUUID(), createdAt: Date.now() };
        approvalWaiters.set(approval.id, resolve);
        set({ approvals: [...get().approvals, approval] });
      }),
      notify: (title, body) => { void notify(title, body); },
    });

    set({ engine });
    void startForeground(goal.slice(0, 60));

    void engine.run(run, { mode }).finally(() => {
      void stopForeground();
      set({ engine: null });
      persistRuns();
    });

    return id;
  },

  async rerunFrom(runId, nodeId) {
    const run = get().runs.find((r) => r.id === runId);
    if (!run) return;
    const idx = run.nodes.findIndex((n) => n.id === nodeId);
    if (idx < 0) return;
    const nodes: TaskNode[] = run.nodes.map((n, i) =>
      i >= idx ? { ...n, status: 'pending', output: undefined, error: undefined, logs: [] } : n);
    const fresh: Run = { ...run, nodes, status: 'running', updatedAt: Date.now() };
    set({ runs: get().runs.map((r) => (r.id === runId ? fresh : r)), activeRunId: runId });

    const engine = new OrchestratorEngine({
      getSettings: () => get().settings,
      getAgents: () => get().agents,
      getProviders: () => get().providers,
      getSpentToday: () => get().spend.byAgent,
      files: {
        list: () => get().files,
        read: (p) => get().files.find((f) => f.path === p)?.content ?? null,
        write: (p, c) => get().writeFile(p, c),
        remove: (p) => get().deleteFile(p),
      },
      onRunUpdate: (r) => { set({ runs: get().runs.map((x) => (x.id === r.id ? { ...r } : x)) }); void saveDoc('runs', get().runs); },
      onNodeUpdate: (rid, node) => set({
        runs: get().runs.map((r) => (r.id === rid ? { ...r, nodes: r.nodes.map((n) => (n.id === node.id ? { ...node } : n)) } : r)),
      }),
      onStream: (rid, nid, chunk) => {
        const key = `${rid}:${nid}`;
        set({ streaming: { ...get().streaming, [key]: ((get().streaming[key] ?? '') + chunk).slice(-20_000) } });
      },
      onAudit: (e) => {
        const audit = [{ ...e, id: crypto.randomUUID(), ts: Date.now() }, ...get().audit].slice(0, 500);
        set({ audit }); void saveDoc('audit', audit);
      },
      onSpend: (agentId, usd) => {
        const spend = get().spend.date === today() ? { ...get().spend } : { date: today(), byAgent: {} };
        spend.byAgent = { ...spend.byAgent, [agentId]: (spend.byAgent[agentId] ?? 0) + usd };
        set({ spend }); void saveDoc('memory', spend);
      },
      requestApproval: (req) => new Promise<boolean>((resolve) => {
        const approval: ApprovalRequest = { ...req, id: crypto.randomUUID(), createdAt: Date.now() };
        approvalWaiters.set(approval.id, resolve);
        set({ approvals: [...get().approvals, approval] });
      }),
      notify: (t, b) => { void notify(t, b); },
    });
    set({ engine });
    void startForeground(run.goal.slice(0, 60));
    void engine.run(fresh, { mode: run.mode }).finally(() => { void stopForeground(); set({ engine: null }); });
  },

  pauseRun() { get().engine?.pause(); },
  resumeRun() { get().engine?.resume(); },
  cancelRun() { get().engine?.cancel(); void stopForeground(); },

  async deleteRun(id) {
    const runs = get().runs.filter((r) => r.id !== id);
    set({ runs, activeRunId: get().activeRunId === id ? null : get().activeRunId });
    await saveDoc('runs', runs);
  },

  resolveApproval(id, approved) {
    const waiter = approvalWaiters.get(id);
    waiter?.(approved);
    approvalWaiters.delete(id);
    set({ approvals: get().approvals.filter((a) => a.id !== id) });
  },

  async clearAudit() { set({ audit: [] }); await saveDoc('audit', []); },
}));
