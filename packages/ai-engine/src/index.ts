export interface AiConfig {
  enabled: boolean;
  provider: 'none' | 'ollama' | 'openai';
  endpoint?: string;
  model?: string;
  apiKey?: string;
}

export class AiEngine {
  private config: AiConfig;

  constructor(config?: Partial<AiConfig>) {
    this.config = {
      enabled: config?.enabled ?? false,
      provider: config?.provider ?? 'none',
      endpoint: config?.endpoint || (config?.provider === 'ollama' ? 'http://127.0.0.1:11434' : ''),
      model: config?.model || (config?.provider === 'ollama' ? 'qwen2.5-coder:7b' : 'gpt-4o-mini'),
      apiKey: config?.apiKey || process.env.CODEARCH_AI_KEY || ''
    };
  }

  public getStatus(): {
    enabled: boolean;
    provider: string;
    model?: string;
    statusText: string;
  } {
    if (!this.config.enabled || this.config.provider === 'none') {
      return {
        enabled: false,
        provider: 'none',
        statusText: '● LOCAL ANALYSIS (100% Offline, Privacy Guaranteed)'
      };
    }

    if (this.config.provider === 'ollama') {
      return {
        enabled: true,
        provider: 'ollama',
        model: this.config.model,
        statusText: `● AI ENABLED — Ollama (${this.config.model})`
      };
    }

    return {
      enabled: true,
      provider: 'openai',
      model: this.config.model,
      statusText: `● AI ENABLED — Remote (${this.config.model})`
    };
  }

  public async summarizeCodeStory(
    symbolName: string,
    evolution: Array<{ version: string; title: string; author: string; date: string }>
  ): Promise<string> {
    if (this.config.enabled && this.config.provider !== 'none') {
      try {
        const prompt = `Summarize the evolution and intent of code symbol "${symbolName}" based on these historical milestones:\n` +
          evolution.map((m) => `- ${m.version}: ${m.title} (${m.author}, ${m.date})`).join('\n') +
          `\nProvide a concise 2-sentence summary of why it was created and how it changed.`;

        const response = await this.callProvider(prompt);
        if (response) return response.trim();
      } catch {
        // Fallback gracefully
      }
    }

    // Deterministic offline heuristic summary
    if (evolution.length === 0) {
      return `"${symbolName}" is an active component currently without recorded git commit history.`;
    }

    const first = evolution[0];
    const last = evolution[evolution.length - 1];

    if (evolution.length === 1) {
      return `Introduced in ${first.version} as "${first.title}". The symbol remains in its initial release form.`;
    }

    return `The symbol "${symbolName}" was initially introduced for ${first.title}. Across ${evolution.length} iterations, it evolved into a shared component, most recently updated in ${last.version} ("${last.title}").`;
  }

  public async explainArchitectureIntent(moduleName: string, files: string[]): Promise<string> {
    if (this.config.enabled && this.config.provider !== 'none') {
      try {
        const prompt = `Explain the architectural purpose of module "${moduleName}" containing files: ${files.slice(0, 10).join(', ')}. Keep it under 2 sentences.`;
        const res = await this.callProvider(prompt);
        if (res) return res.trim();
      } catch {
        // Fallback
      }
    }

    return `Module "${moduleName}" organizes ${files.length} related source files to encapsulate core domain responsibility.`;
  }

  private async callProvider(prompt: string): Promise<string | null> {
    if (this.config.provider === 'ollama') {
      const endpoint = `${this.config.endpoint?.replace(/\/$/, '')}/api/generate`;
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: this.config.model,
          prompt,
          stream: false
        })
      });
      if (!res.ok) return null;
      const data = (await res.json()) as any;
      return data.response || null;
    }

    if (this.config.provider === 'openai' && this.config.endpoint) {
      const endpoint = `${this.config.endpoint?.replace(/\/$/, '')}/chat/completions`;
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (this.config.apiKey) headers['Authorization'] = `Bearer ${this.config.apiKey}`;

      const res = await fetch(endpoint, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          model: this.config.model,
          messages: [{ role: 'user', content: prompt }],
          temperature: 0.2
        })
      });
      if (!res.ok) return null;
      const data = (await res.json()) as any;
      return data.choices?.[0]?.message?.content || null;
    }

    return null;
  }
}
