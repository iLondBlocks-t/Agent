import type { ModelInfo, ProviderConfig } from '@/types';
import { httpJson } from './http';
import { OpenAICompatibleProvider } from './openaiCompatible';

/** Remote Ollama server, using its OpenAI-compatible /v1 endpoint. */
export class OllamaProvider extends OpenAICompatibleProvider {
  constructor(config: ProviderConfig) {
    super(config, { kind: 'ollama', defaultBaseUrl: 'http://localhost:11434/v1', supportsTools: true });
  }

  override async listModels(): Promise<ModelInfo[]> {
    const root = this.baseUrl.replace(/\/v1$/, '');
    try {
      const data = await httpJson<any>(`${root}/api/tags`, { timeoutMs: 15_000 });
      return (data.models ?? []).map((m: any) => ({ id: m.name, name: m.name }));
    } catch { return super.listModels(); }
  }
}
