import type { Provider, ProviderConfig, ProviderKind } from '@/types';
import { AnthropicProvider } from './anthropic';
import { ArenaProvider } from './arena';
import { CustomOpenAIProvider } from './custom';
import { DeepSeekProvider } from './deepseek';
import { GeminiProvider } from './gemini';
import { GroqProvider } from './groq';
import { OllamaProvider } from './ollama';
import { OpenCodeProvider } from './opencode';
import { OpenRouterProvider } from './openrouter';

export interface ProviderMeta {
  kind: ProviderKind;
  label: string;
  defaultBaseUrl: string;
  needsKey: boolean;
  docs: string;
}

/** Add a new provider by adding ONE file + one entry here. */
export const PROVIDER_CATALOG: ProviderMeta[] = [
  { kind: 'openrouter', label: 'OpenRouter', defaultBaseUrl: 'https://openrouter.ai/api/v1', needsKey: true, docs: 'https://openrouter.ai/keys' },
  { kind: 'gemini', label: 'Google Gemini', defaultBaseUrl: 'https://generativelanguage.googleapis.com/v1beta', needsKey: true, docs: 'https://aistudio.google.com/app/apikey' },
  { kind: 'anthropic', label: 'Anthropic', defaultBaseUrl: 'https://api.anthropic.com/v1', needsKey: true, docs: 'https://console.anthropic.com/settings/keys' },
  { kind: 'openai-compatible', label: 'OpenAI-compatible (مخصص)', defaultBaseUrl: 'https://api.openai.com/v1', needsKey: true, docs: 'https://platform.openai.com/api-keys' },
  { kind: 'arena', label: 'Arena AI', defaultBaseUrl: 'https://api.arena.ai/v1', needsKey: true, docs: 'https://arena.ai' },
  { kind: 'opencode', label: 'OpenCode', defaultBaseUrl: 'https://opencode.ai/v1', needsKey: true, docs: 'https://opencode.ai' },
  { kind: 'groq', label: 'Groq', defaultBaseUrl: 'https://api.groq.com/openai/v1', needsKey: true, docs: 'https://console.groq.com/keys' },
  { kind: 'deepseek', label: 'DeepSeek', defaultBaseUrl: 'https://api.deepseek.com/v1', needsKey: true, docs: 'https://platform.deepseek.com/api_keys' },
  { kind: 'ollama', label: 'Ollama (رابط بعيد)', defaultBaseUrl: 'http://localhost:11434/v1', needsKey: false, docs: 'https://ollama.com' },
];

export function createProvider(config: ProviderConfig): Provider {
  switch (config.kind) {
    case 'openrouter': return new OpenRouterProvider(config);
    case 'gemini': return new GeminiProvider(config);
    case 'anthropic': return new AnthropicProvider(config);
    case 'arena': return new ArenaProvider(config);
    case 'opencode': return new OpenCodeProvider(config);
    case 'groq': return new GroqProvider(config);
    case 'deepseek': return new DeepSeekProvider(config);
    case 'ollama': return new OllamaProvider(config);
    case 'openai-compatible':
    default: return new CustomOpenAIProvider(config);
  }
}

export function metaFor(kind: ProviderKind): ProviderMeta {
  return PROVIDER_CATALOG.find((p) => p.kind === kind) ?? PROVIDER_CATALOG[3];
}
