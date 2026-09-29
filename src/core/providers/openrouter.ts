import type { ProviderConfig } from '@/types';
import { OpenAICompatibleProvider } from './openaiCompatible';

export class OpenRouterProvider extends OpenAICompatibleProvider {
  constructor(config: ProviderConfig) {
    super(config, {
      kind: 'openrouter',
      defaultBaseUrl: 'https://openrouter.ai/api/v1',
      extraHeaders: { 'HTTP-Referer': 'https://github.com/multi-ai-agent-orchestrator', 'X-Title': 'Multi-AI Agent Orchestrator' },
      fallbackModels: [
        { id: 'openai/gpt-4o-mini', name: 'GPT-4o mini' },
        { id: 'anthropic/claude-3.5-sonnet', name: 'Claude 3.5 Sonnet' },
        { id: 'google/gemini-2.0-flash-001', name: 'Gemini 2.0 Flash' },
      ],
    });
  }
}
