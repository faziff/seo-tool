import { GoogleGenAI } from '@google/genai';
import { secretFingerprint, withRequestCache } from './request_cache.js';

export type AIProviderName = 'gemini' | 'hermes' | 'openrouter' | 'groq';

export interface AIProviderStatus {
  provider: AIProviderName | 'demo';
  configured: boolean;
  mode: 'live' | 'demo';
  model: string;
  note: string;
}

interface ProviderConfig {
  provider: AIProviderName;
  apiKey: string;
  baseUrl?: string;
  model: string;
}

interface AITextResult {
  text: string;
  provider: AIProviderName;
}

const supportedProviders: AIProviderName[] = ['gemini', 'hermes', 'openrouter', 'groq'];

function env(value: string | undefined): string {
  return (value || '').trim();
}

function configuredProvider(name: AIProviderName): ProviderConfig | null {
  if (name === 'gemini') {
    const apiKey = env(process.env.GEMINI_API_KEY);
    return apiKey ? {
      provider: name,
      apiKey,
      model: env(process.env.GEMINI_MODEL) || 'gemini-2.5-flash'
    } : null;
  }

  if (name === 'hermes') {
    const apiKey = env(process.env.HERMES_API_KEY);
    return apiKey ? {
      provider: name,
      apiKey,
      baseUrl: env(process.env.HERMES_BASE_URL) || 'http://localhost:8000/v1',
      model: env(process.env.HERMES_MODEL) || 'NousResearch/Hermes-3-Llama-3.1-8B'
    } : null;
  }

  if (name === 'openrouter') {
    const apiKey = env(process.env.OPENROUTER_API_KEY);
    return apiKey ? {
      provider: name,
      apiKey,
      baseUrl: env(process.env.OPENROUTER_BASE_URL) || 'https://openrouter.ai/api/v1',
      model: env(process.env.OPENROUTER_MODEL) || 'openrouter/auto'
    } : null;
  }

  const apiKey = env(process.env.GROQ_API_KEY);
  return apiKey ? {
    provider: name,
    apiKey,
    baseUrl: env(process.env.GROQ_BASE_URL) || 'https://api.groq.com/openai/v1',
    model: env(process.env.GROQ_MODEL) || 'llama-3.3-70b-versatile'
  } : null;
}

function selectedConfig(): ProviderConfig | null {
  const requested = env(process.env.AI_PROVIDER).toLowerCase();
  if (requested) {
    if (!supportedProviders.includes(requested as AIProviderName)) {
      console.warn(`[CROX AI] Unknown AI_PROVIDER value. Supported providers: ${supportedProviders.join(', ')}.`);
      return null;
    }
    // Respect explicit selection; never silently bill a different provider.
    return configuredProvider(requested as AIProviderName);
  }

  for (const provider of supportedProviders) {
    const config = configuredProvider(provider);
    if (config) return config;
  }
  return null;
}

export function getAIProviderStatus(): AIProviderStatus {
  const config = selectedConfig();
  if (!config) {
    const requested = env(process.env.AI_PROVIDER);
    return {
      provider: 'demo',
      configured: false,
      mode: 'demo',
      model: 'crox-local-guidance',
      note: requested
        ? `AI_PROVIDER is set to "${requested}", but its credentials are not configured. CROX uses local demo guidance.`
        : 'No AI provider key is configured. CROX uses local demo guidance.'
    };
  }
  return {
    provider: config.provider,
    configured: true,
    mode: 'live',
    model: config.model,
    note: `Server-side ${config.provider} provider is configured.`
  };
}

async function requestOpenAICompatible(config: ProviderConfig, prompt: string): Promise<AITextResult> {
  const baseUrl = String(config.baseUrl || '').replace(/\/+$/, '');
  if (!/^https?:\/\//i.test(baseUrl)) {
    throw new Error(`The configured ${config.provider} base URL must use HTTP or HTTPS.`);
  }

  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${config.apiKey}`,
      'Content-Type': 'application/json',
      ...(config.provider === 'openrouter' ? {
        'HTTP-Referer': env(process.env.OPENROUTER_SITE_URL) || 'https://crox.app',
        'X-Title': env(process.env.OPENROUTER_APP_NAME) || 'CROX SEO Intelligence'
      } : {})
    },
    body: JSON.stringify({
      model: config.model,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.35
    }),
    signal: AbortSignal.timeout(45_000)
  });

  if (!response.ok) {
    // Provider bodies can contain user data or echoes; keep errors short and redact credentials.
    const detail = (await response.text().catch(() => ''))
      .replaceAll(config.apiKey, '[redacted]')
      .replace(/\s+/g, ' ')
      .slice(0, 180);
    throw new Error(`${config.provider} request failed with HTTP ${response.status}${detail ? `: ${detail}` : ''}`);
  }

  const payload = await response.json() as {
    choices?: Array<{ message?: { content?: string | Array<{ type?: string; text?: string }> } }>;
    error?: { message?: string };
  };
  const content = payload.choices?.[0]?.message?.content;
  const text = Array.isArray(content)
    ? content.map(part => part?.text || '').join('\n').trim()
    : String(content || '').trim();
  if (!text) {
    const providerError = String(payload.error?.message || `${config.provider} returned an empty response.`)
      .replaceAll(config.apiKey, '[redacted]')
      .slice(0, 180);
    throw new Error(providerError);
  }
  return { text, provider: config.provider };
}

/** One server-only text generation gateway for Gemini and OpenAI-compatible providers. */
export async function generateAIText(prompt: string): Promise<AITextResult> {
  const config = selectedConfig();
  if (!config) throw new Error('No configured AI provider.');

  const cleanPrompt = String(prompt || '').trim();
  if (!cleanPrompt) throw new Error('AI prompt cannot be empty.');
  if (cleanPrompt.length > 60_000) throw new Error('AI prompt is too long. Limit prompts to 60,000 characters.');

  return withRequestCache<AITextResult>(
    'ai:text-generation',
    {
      provider: config.provider,
      model: config.model,
      baseUrl: config.baseUrl || '',
      credential: secretFingerprint(config.apiKey),
      prompt: cleanPrompt
    },
    async () => {
      if (config.provider === 'gemini') {
        const client = new GoogleGenAI({ apiKey: config.apiKey });
        const response = await client.models.generateContent({ model: config.model, contents: cleanPrompt });
        const text = String(response.text || '').trim();
        if (!text) throw new Error('Gemini returned an empty response.');
        return { text, provider: config.provider };
      }
      return requestOpenAICompatible(config, cleanPrompt);
    },
    { ttlEnvVar: 'AI_CACHE_TTL_SECONDS', defaultTtlSeconds: 300, maxEntries: 500 }
  );
}
