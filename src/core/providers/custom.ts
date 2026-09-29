import type { ProviderConfig } from '@/types';
import { OpenAICompatibleProvider } from './openaiCompatible';

/** Any OpenAI-compatible endpoint: name + base URL + key + model. */
export class CustomOpenAIProvider extends OpenAICompatibleProvider {
  constructor(config: ProviderConfig) {
    super(config, { kind: 'openai-compatible', defaultBaseUrl: 'https://api.openai.com/v1' });
  }
}
