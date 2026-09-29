import type { ProviderConfig } from '@/types';
import { OpenAICompatibleProvider } from './openaiCompatible';

/** Arena AI exposes an OpenAI-compatible gateway; base URL is overridable in Settings. */
export class ArenaProvider extends OpenAICompatibleProvider {
  constructor(config: ProviderConfig) {
    super(config, {
      kind: 'arena',
      defaultBaseUrl: 'https://api.arena.ai/v1',
      fallbackModels: [
        { id: 'arena-default', name: 'Arena Default' },
        { id: 'gpt-4o-mini', name: 'GPT-4o mini (via Arena)' },
      ],
    });
  }
}
