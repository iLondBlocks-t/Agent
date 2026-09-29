export type ProviderKind =
  | 'openrouter' | 'gemini' | 'anthropic' | 'openai-compatible'
  | 'arena' | 'opencode' | 'groq' | 'deepseek' | 'ollama';

export interface ProviderConfig {
  id: string;
  kind: ProviderKind;
  name: string;
  baseUrl?: string;
  apiKey?: string;
  defaultModel?: string;
  enabled: boolean;
  createdAt: number;
}

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  name?: string;
  toolCallId?: string;
  toolCalls?: ToolCall[];
}

export interface ToolCall {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
}

export interface ToolSchema {
  name: string;
  description: string;
  permission: PermissionKey;
  minLevel: PermissionLevel;
  destructive?: boolean;
  parameters: {
    type: 'object';
    properties: Record<string, { type: string; description: string; enum?: string[] }>;
    required: string[];
  };
}

export interface ChatRequest {
  model: string;
  messages: ChatMessage[];
  temperature?: number;
  maxTokens?: number;
  tools?: ToolSchema[];
  signal?: AbortSignal;
}

export interface Usage { promptTokens: number; completionTokens: number; totalTokens: number; costUsd: number; }

export interface ChatResponse {
  content: string;
  toolCalls: ToolCall[];
  usage: Usage;
  model: string;
  raw?: unknown;
}

export interface ModelInfo { id: string; name: string; contextLength?: number; promptCostPer1k?: number; completionCostPer1k?: number; }

export interface Provider {
  readonly kind: ProviderKind;
  readonly id: string;
  readonly name: string;
  readonly supportsTools: boolean;
  chat(req: ChatRequest): Promise<ChatResponse>;
  stream(req: ChatRequest, onDelta: (chunk: string) => void): Promise<ChatResponse>;
  listModels(): Promise<ModelInfo[]>;
  testConnection(): Promise<{ ok: boolean; message: string }>;
}

export type PermissionKey = 'github' | 'discord' | 'files' | 'terminal' | 'web' | 'none';
export type PermissionLevel = 'off' | 'read' | 'write' | 'admin';

export const LEVEL_ORDER: Record<PermissionLevel, number> = { off: 0, read: 1, write: 2, admin: 3 };

export type PermissionMatrix = Record<Exclude<PermissionKey, 'none'>, PermissionLevel>;

export type AgentRole =
  | 'planner' | 'coder' | 'reviewer' | 'devops' | 'researcher'
  | 'designer' | 'tester' | 'writer' | 'discord' | 'custom';

export interface Agent {
  id: string;
  name: string;
  role: AgentRole;
  systemPrompt: string;
  providerId: string;
  model: string;
  fallbackProviderId?: string;
  fallbackModel?: string;
  allowedTools: string[];
  permissions: PermissionMatrix;
  temperature: number;
  dailySpendLimitUsd: number;
  enabled: boolean;
  // quality/speed/cost hints 0..1 used by the router
  quality: number;
  speed: number;
  costFactor: number;
}

export type TaskStatus = 'pending' | 'running' | 'blocked' | 'done' | 'failed' | 'cancelled' | 'paused';
export type RunMode = 'manual' | 'semi' | 'auto';

export interface TaskNode {
  id: string;
  title: string;
  description: string;
  agentId?: string;
  dependsOn: string[];
  status: TaskStatus;
  output?: string;
  error?: string;
  usage: Usage;
  startedAt?: number;
  finishedAt?: number;
  logs: string[];
}

export interface Run {
  id: string;
  goal: string;
  mode: RunMode;
  status: TaskStatus;
  nodes: TaskNode[];
  createdAt: number;
  updatedAt: number;
  totalUsage: Usage;
  memory: string[];
  summary?: string;
}

export interface ApprovalRequest {
  id: string;
  runId: string;
  nodeId: string;
  agentId: string;
  tool: string;
  args: Record<string, unknown>;
  risk: 'low' | 'medium' | 'high';
  reason: string;
  createdAt: number;
  resolved?: 'approved' | 'rejected';
}

export interface AuditEntry {
  id: string;
  ts: number;
  agentId: string;
  tool: string;
  action: string;
  allowed: boolean;
  detail: string;
}

export interface Settings {
  language: 'ar' | 'en';
  amoled: boolean;
  reduceMotion: boolean;
  killSwitch: boolean;
  terminalBackendUrl: string;
  terminalBackendToken: string;
  githubToken: string;
  discordBotToken: string;
  searchBackend: 'duckduckgo' | 'none';
  globalDailyLimitUsd: number;
  maxParallel: number;
}
