import type { ProviderConfig } from '@/types';
import { OpenAICompatibleProvider } from './openaiCompatible';

export class GroqProvider extends OpenAICompatibleProvider {
  constructor(config: ProviderConfig) {
    super(config, {
      kind: 'groq',
      defaultBaseUrl: 'https://api.groq.com/openai/v1',
      fallbackModels: [
        { id: 'llama-3.3-70b-versatile', name: 'Llama 3.3 70B' },
        { id: 'llama-3.1-8b-instant', name: 'Llama 3.1 8B Instant' },
      ],
    });
  }
}
