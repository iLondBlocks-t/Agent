import type { ProviderConfig } from '@/types';
import { OpenAICompatibleProvider } from './openaiCompatible';

/** OpenCode server exposes an OpenAI-compatible endpoint (default local/remote server URL). */
export class OpenCodeProvider extends OpenAICompatibleProvider {
  constructor(config: ProviderConfig) {
    super(config, {
      kind: 'opencode',
      defaultBaseUrl: 'https://opencode.ai/v1',
      fallbackModels: [{ id: 'opencode-default', name: 'OpenCode Default' }],
    });
  }
}
