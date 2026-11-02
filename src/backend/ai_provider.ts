import { GoogleGenAI } from '@google/genai';
import { secretFingerprint, withRequestCache } from './request_cache.js';
import { db } from './db.js';
import { decryptProviderKey } from './ai_key_vault.js';

export type AIProviderName = 'gemini' | 'openai' | 'anthropic' | 'openrouter' | 'groq' | 'mistral' | 'hermes';
export type UserFacingAIProvider = Exclude<AIProviderName, 'hermes'>;
export type AIProviderFailureClass = 'authentication' | 'quota' | 'rate_limit' | 'temporary' | 'policy' | 'fatal';

export interface AIProviderStatus {
  provider: AIProviderName | 'demo';
  configured: boolean;
  mode: 'live' | 'demo';
  model: string;
  note: string;
}

export interface AIProviderSetting {
  provider: UserFacingAIProvider;
  label: string;
  configured: boolean;
  enabled: boolean;
  source: 'account' | 'server' | 'mixed' | 'none';
  model: string;
  key_hint: string;
  key_count: number;
  updated_at?: string;
}

interface ProviderConfig {
  provider: AIProviderName;
  apiKey: string;
  baseUrl?: string;
  model: string;
  keySource: 'account' | 'server';
  keySlot: number;
  userId?: number;
}

export interface AITextResult {
  text: string;
  provider: AIProviderName;
  model?: string;
  fallback_used?: boolean;
  attempts?: number;
}

interface ProviderDefinition {
  provider: UserFacingAIProvider;
  label: string;
  model: string;
  envKey: string;
  baseUrl?: string;
}

export class AIProviderRequestError extends Error {
  status: number;
  code: string;
  failureClass: AIProviderFailureClass;
  retryAfterMs: number | null;

  constructor(message: string, options: { status?: number; code?: string; failureClass: AIProviderFailureClass; retryAfterMs?: number | null }) {
    super(message);
    this.name = 'AIProviderRequestError';
    this.status = options.status || 0;
    this.code = options.code || '';
    this.failureClass = options.failureClass;
    this.retryAfterMs = options.retryAfterMs ?? null;
  }
}

const providerDefinitions: ProviderDefinition[] = [
  { provider: 'gemini', label: 'Google Gemini', model: 'gemini-3.8-flash', envKey: 'GEMINI_API_KEY' },
  { provider: 'openai', label: 'OpenAI', model: 'gpt-6-luna', envKey: 'OPENAI_API_KEY', baseUrl: 'https://api.openai.com/v1' },
  { provider: 'anthropic', label: 'Anthropic Claude', model: 'claude-haiku-5-5', envKey: 'ANTHROPIC_API_KEY', baseUrl: 'https://api.anthropic.com/v1' },
  { provider: 'openrouter', label: 'OpenRouter', model: 'openrouter/auto', envKey: 'OPENROUTER_API_KEY', baseUrl: 'https://openrouter.ai/api/v1' },
  { provider: 'groq', label: 'Groq', model: 'openai/gpt-oss-120b', envKey: 'GROQ_API_KEY', baseUrl: 'https://api.groq.com/openai/v1' },
  { provider: 'mistral', label: 'Mistral AI', model: 'mistral-large-4', envKey: 'MISTRAL_API_KEY', baseUrl: 'https://api.mistral.ai/v1' }
];
const supportedProviders: AIProviderName[] = [...providerDefinitions.map(item => item.provider), 'hermes'];
const defaultOrder: UserFacingAIProvider[] = ['gemini', 'openai', 'anthropic', 'openrouter', 'groq', 'mistral'];
const MAX_INLINE_RETRIES = 1;
const MAX_RETRY_AFTER_MS = 2500;
const PROVIDER_COOLDOWN_MS: Record<'quota' | 'rate_limit' | 'temporary', number> = { quota: 120_000, rate_limit: 30_000, temporary: 15_000 };
const providerCooldowns = new Map<string, number>();

function env(value: string | undefined): string { return (value || '').trim(); }
function definition(name: AIProviderName) { return providerDefinitions.find(item => item.provider === name); }

function splitKeyList(raw: string): string[] {
  const value = raw.trim();
  if (!value) return [];
  if (value.startsWith('[')) {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) return parsed.map(item => String(item || '').trim()).filter(Boolean);
    } catch { /* treat as a delimited secret list below */ }
  }
  return value.split(/[\r\n,;]+/).map(item => item.trim()).filter(Boolean);
}

/** Multiple server-managed credentials are read only inside the Node process. Never serialize these values. */
function environmentKeys(meta: ProviderDefinition): string[] {
  const prefix = meta.envKey.replace(/_API_KEY$/, '');
  const keys = [
    ...splitKeyList(process.env[meta.envKey] || ''),
    ...splitKeyList(process.env[`${prefix}_API_KEYS`] || '')
  ];
  for (let index = 1; index <= 10; index++) {
    const numbered = env(process.env[`${meta.envKey}_${index}`] || process.env[`${prefix}_API_KEY_${index}`]);
    if (numbered) keys.push(numbered);
  }
  return [...new Set(keys)];
}

function environmentConfigs(name: AIProviderName): ProviderConfig[] {
  if (name === 'hermes') {
    const apiKey = env(process.env.HERMES_API_KEY);
    return apiKey ? [{ provider: name, apiKey, baseUrl: env(process.env.HERMES_BASE_URL) || 'http://localhost:8000/v1', model: env(process.env.HERMES_MODEL) || 'NousResearch/Hermes-3-Llama-3.1-8B', keySource: 'server', keySlot: 1 }] : [];
  }
  const meta = definition(name);
  if (!meta) return [];
  const prefix = meta.envKey.replace(/_API_KEY$/, '');
  const baseUrl = env(process.env[`${prefix}_BASE_URL`]) || meta.baseUrl;
  const model = env(process.env[`${prefix}_MODEL`]) || meta.model;
  return environmentKeys(meta).map((apiKey, index) => ({ provider: name, apiKey, baseUrl, model, keySource: 'server', keySlot: index + 1 }));
}

function accountConfig(userId: number, name: AIProviderName): ProviderConfig | null {
  if (name === 'hermes') return null;
  const saved = db.getUserAICredential(userId, name);
  if (!saved || !saved.enabled) return null;
  try {
    const meta = definition(name);
    if (!meta) return null;
    return {
      provider: name,
      apiKey: decryptProviderKey(saved),
      baseUrl: meta.baseUrl,
      model: saved.model || meta.model,
      keySource: 'account',
      keySlot: 0,
      userId
    };
  } catch {
    console.error(`[CROX AI] Could not decrypt saved ${name} credential. Check AI_KEYS_ENCRYPTION_SECRET/JWT_SECRET stability.`);
    return null;
  }
}

function providerOrder(userId?: number): AIProviderName[] {
  const requested = env(process.env.AI_PROVIDER).toLowerCase();
  const serverOrder = defaultOrder.includes(requested as UserFacingAIProvider)
    ? [requested as UserFacingAIProvider, ...defaultOrder.filter(name => name !== requested)]
    : defaultOrder;
  if (!userId) {
    if (requested && supportedProviders.includes(requested as AIProviderName)) {
      return [requested as AIProviderName, ...defaultOrder.filter(name => name !== requested), 'hermes'];
    }
    return [...defaultOrder, 'hermes'];
  }
  const user = db.findUserById(userId);
  const savedOrder = Array.isArray(user?.settings?.aiProviderOrder)
    ? user!.settings.aiProviderOrder.filter((name: unknown): name is UserFacingAIProvider => typeof name === 'string' && defaultOrder.includes(name as UserFacingAIProvider))
    : [];
  const preferred = savedOrder.length ? savedOrder : serverOrder;
  return [...preferred, ...defaultOrder.filter(name => !preferred.includes(name)), 'hermes'];
}

function configsForUser(userId?: number, providerOverride?: AIProviderName): ProviderConfig[] {
  const order = providerOverride ? [providerOverride] : providerOrder(userId);
  const configs: ProviderConfig[] = [];
  for (const name of order) {
    if (userId) {
      const account = accountConfig(userId, name);
      if (account) configs.push(account);
    }
    configs.push(...environmentConfigs(name).map(config => ({ ...config, userId })));
  }
  const seen = new Set<string>();
  return configs.filter(config => {
    const id = `${config.provider}:${secretFingerprint(config.apiKey)}`;
    if (seen.has(id)) return false;
    seen.add(id);
    return true;
  });
}

function errorBodyDetails(body: string): { message: string; code: string; type: string } {
  try {
    const parsed = JSON.parse(body || '{}');
    const nested = parsed?.error || parsed?.detail || parsed;
    return {
      message: String(nested?.message || nested?.detail || parsed?.message || body || 'Provider request failed.').slice(0, 500),
      code: String(nested?.code || nested?.type || parsed?.code || '').slice(0, 120),
      type: String(nested?.type || parsed?.type || '').slice(0, 120)
    };
  } catch {
    return { message: String(body || 'Provider request failed.').slice(0, 500), code: '', type: '' };
  }
}

function retryAfterMs(response: Response, body: string): number | null {
  const header = response.headers.get('retry-after');
  if (header) {
    const seconds = Number(header);
    if (Number.isFinite(seconds)) return Math.max(0, seconds * 1000);
    const date = Date.parse(header);
    if (Number.isFinite(date)) return Math.max(0, date - Date.now());
  }
  const reset = response.headers.get('x-ratelimit-reset-requests') || response.headers.get('x-ratelimit-reset-tokens');
  if (reset) {
    const match = reset.match(/(?:(\d+(?:\.\d+)?)m)?(?:(\d+(?:\.\d+)?)s)?/i);
    if (match && (match[1] || match[2])) return Math.max(0, (Number(match[1] || 0) * 60 + Number(match[2] || 0)) * 1000);
  }
  const details = errorBodyDetails(body);
  const retryText = `${details.message} ${details.code} ${details.type}`;
  const seconds = retryText.match(/retry(?:\s+after|\s+in)?\s+(\d+(?:\.\d+)?)\s*(?:s|sec|seconds?)/i);
  return seconds ? Math.max(0, Number(seconds[1]) * 1000) : null;
}

function classifyFailure(status: number, code: string, type: string, message: string): AIProviderFailureClass {
  const text = `${code} ${type} ${message}`.toLowerCase();
  if (status === 401 || /invalid_api_key|authentication_error|invalid api key|incorrect api key/.test(text)) return 'authentication';
  if (status === 403 || /permission_error|policy|safety|not allowed|unsupported country|region not supported/.test(text)) return 'policy';
  if (status === 429 || status === 402 || /insufficient_quota|quota_exceeded|credit_balance_exhausted|spend_limit|usage_limit|billing|resource_exhausted/.test(text)) {
    if (/insufficient_quota|quota_exceeded|credit_balance_exhausted|spend_limit|usage_limit|billing|daily quota|monthly quota/.test(text)) return 'quota';
    return 'rate_limit';
  }
  if ([408, 409, 425, 500, 502, 503, 504, 529].includes(status) || /temporarily unavailable|overloaded|timeout|connection reset/.test(text)) return 'temporary';
  return 'fatal';
}

function safeProviderError(message: string, apiKey: string): string {
  return String(message || 'Provider request failed.')
    .replaceAll(apiKey, '[redacted]')
    .replace(/Bearer\s+[^\s,;]+/gi, 'Bearer [redacted]')
    .replace(/(?:sk-[A-Za-z0-9_-]{8,}|AIza[\w-]{15,})/g, '[redacted-key]')
    .replace(/\s+/g, ' ')
    .slice(0, 220);
}

async function providerFetch(config: ProviderConfig, url: string, init: RequestInit): Promise<Response> {
  const response = await fetch(url, { ...init, signal: init.signal || AbortSignal.timeout(35_000) });
  if (!response.ok) {
    const body = await response.text().catch(() => '');
    const details = errorBodyDetails(body);
    throw new AIProviderRequestError(
      safeProviderError(`${config.provider} request failed with HTTP ${response.status}: ${details.message}`, config.apiKey),
      {
        status: response.status,
        code: details.code || details.type,
        failureClass: classifyFailure(response.status, details.code, details.type, details.message),
        retryAfterMs: retryAfterMs(response, body)
      }
    );
  }
  return response;
}

async function requestOpenAICompatible(config: ProviderConfig, prompt: string): Promise<AITextResult> {
  const baseUrl = String(config.baseUrl || '').replace(/\/+$/, '');
  if (!/^https:\/\//i.test(baseUrl) && !(config.provider === 'hermes' && /^http:\/\//i.test(baseUrl))) {
    throw new AIProviderRequestError(`The configured ${config.provider} base URL must use HTTPS.`, { failureClass: 'fatal' });
  }
  const response = await providerFetch(config, `${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${config.apiKey}`,
      'Content-Type': 'application/json',
      ...(config.provider === 'openrouter' ? { 'HTTP-Referer': env(process.env.OPENROUTER_SITE_URL) || 'https://crox.app', 'X-Title': env(process.env.OPENROUTER_APP_NAME) || 'CROX SEO Intelligence' } : {})
    },
    body: JSON.stringify({ model: config.model, messages: [{ role: 'user', content: prompt }], temperature: 0.35 })
  });
  const payload = await response.json() as { choices?: Array<{ message?: { content?: string | Array<{ type?: string; text?: string }> } }>; error?: { message?: string } };
  const content = payload.choices?.[0]?.message?.content;
  const text = Array.isArray(content) ? content.map(part => part?.text || '').join('\n').trim() : String(content || '').trim();
  if (!text) throw new AIProviderRequestError(safeProviderError(payload.error?.message || `${config.provider} returned an empty response.`, config.apiKey), { failureClass: 'temporary' });
  return { text, provider: config.provider, model: config.model };
}

async function requestOpenAIResponses(config: ProviderConfig, prompt: string): Promise<AITextResult> {
  const baseUrl = String(config.baseUrl || 'https://api.openai.com/v1').replace(/\/+$/, '');
  if (!/^https:\/\//i.test(baseUrl)) throw new AIProviderRequestError('The OpenAI API base URL must use HTTPS.', { failureClass: 'fatal' });
  const response = await providerFetch(config, `${baseUrl}/responses`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${config.apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: config.model, input: prompt })
  });
  const payload = await response.json() as { output_text?: string; output?: Array<{ type?: string; content?: Array<{ type?: string; text?: string }> }>; error?: { message?: string } };
  const output = String(payload.output_text || (payload.output || []).flatMap(item => item.content || []).filter(part => part.type === 'output_text' || part.text).map(part => part.text || '').join('\n')).trim();
  if (!output) throw new AIProviderRequestError(safeProviderError(payload.error?.message || 'OpenAI returned an empty response.', config.apiKey), { failureClass: 'temporary' });
  return { text: output, provider: config.provider, model: config.model };
}

async function requestAnthropic(config: ProviderConfig, prompt: string): Promise<AITextResult> {
  const baseUrl = String(config.baseUrl || 'https://api.anthropic.com/v1').replace(/\/+$/, '');
  const response = await providerFetch(config, `${baseUrl}/messages`, {
    method: 'POST',
    headers: { 'x-api-key': config.apiKey, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
    body: JSON.stringify({ model: config.model, max_tokens: 1800, messages: [{ role: 'user', content: prompt }] })
  });
  const payload = await response.json() as { content?: Array<{ type?: string; text?: string }>; error?: { message?: string } };
  const text = (payload.content || []).filter(part => part.type === 'text').map(part => part.text || '').join('\n').trim();
  if (!text) throw new AIProviderRequestError(safeProviderError(payload.error?.message || 'Anthropic returned an empty response.', config.apiKey), { failureClass: 'temporary' });
  return { text, provider: config.provider, model: config.model };
}

function normalizeUnknownError(error: unknown, config: ProviderConfig): AIProviderRequestError {
  if (error instanceof AIProviderRequestError) return error;
  const raw = error as any;
  const status = Number(raw?.status || raw?.statusCode || raw?.response?.status || 0);
  const code = String(raw?.code || raw?.error?.status || raw?.error?.code || '');
  const message = safeProviderError(String(raw?.message || error || 'Provider request failed.'), config.apiKey);
  const failureClass = status ? classifyFailure(status, code, '', message)
    : /ENOTFOUND|ECONNRESET|ECONNREFUSED|EAI_AGAIN|ETIMEDOUT|timeout|fetch failed|aborted|network/i.test(`${code} ${message}`) ? 'temporary'
    : /api.?key|unauthorized|authentication/i.test(message) ? 'authentication' : 'fatal';
  return new AIProviderRequestError(message, { status, code, failureClass });
}

async function callProvider(config: ProviderConfig, prompt: string): Promise<AITextResult> {
  try {
    if (config.provider === 'gemini') {
      const client = new GoogleGenAI({ apiKey: config.apiKey });
      const response = await client.models.generateContent({ model: config.model, contents: prompt });
      const text = String(response.text || '').trim();
      if (!text) throw new AIProviderRequestError('Gemini returned an empty response.', { failureClass: 'temporary' });
      return { text, provider: config.provider, model: config.model };
    }
    if (config.provider === 'openai') return await requestOpenAIResponses(config, prompt);
    if (config.provider === 'anthropic') return await requestAnthropic(config, prompt);
    return await requestOpenAICompatible(config, prompt);
  } catch (error) {
    throw normalizeUnknownError(error, config);
  }
}

function wait(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, Math.max(0, Math.min(ms, MAX_RETRY_AFTER_MS))));
}

function retryDelay(error: AIProviderRequestError, retryIndex: number): number | null {
  if (error.retryAfterMs !== null) {
    // Never retry earlier than the provider's requested delay. If the delay is too long,
    // fall back to another independently configured provider rather than bypassing it.
    return error.retryAfterMs <= MAX_RETRY_AFTER_MS ? error.retryAfterMs : null;
  }
  return Math.min(1800, 250 * (2 ** retryIndex) + Math.floor(Math.random() * 150));
}

function cooldownKey(provider: AIProviderName, fingerprint: string): string {
  return `${provider}:${fingerprint}`;
}

function isProviderKeyCoolingDown(config: ProviderConfig): boolean {
  const key = cooldownKey(config.provider, secretFingerprint(config.apiKey));
  const until = providerCooldowns.get(key) || 0;
  if (until <= Date.now()) {
    providerCooldowns.delete(key);
    return false;
  }
  return true;
}

function coolDownProviderKeys(configs: ProviderConfig[], failureClass: 'quota' | 'rate_limit' | 'temporary', retryAfterMs: number | null): void {
  const fallbackDuration = PROVIDER_COOLDOWN_MS[failureClass];
  const duration = retryAfterMs === null
    ? fallbackDuration
    : Math.max(fallbackDuration, Math.min(10 * 60_000, retryAfterMs));
  const until = Date.now() + duration;
  for (const config of configs) {
    providerCooldowns.set(cooldownKey(config.provider, secretFingerprint(config.apiKey)), until);
  }
  // Bound process memory for long-running SaaS instances.
  if (providerCooldowns.size > 2_000) {
    const now = Date.now();
    for (const [key, expiry] of providerCooldowns) if (expiry <= now) providerCooldowns.delete(key);
    while (providerCooldowns.size > 2_000) providerCooldowns.delete(providerCooldowns.keys().next().value!);
  }
}

function recordAttempt(config: ProviderConfig, outcome: 'success' | 'failed', startedAt: number, prompt: string, attempt: number, error?: AIProviderRequestError, outputChars = 0) {
  try {
    db.recordAIProviderUsage({
      user_id: config.userId ?? null,
      provider: config.provider,
      model: config.model,
      key_fingerprint: secretFingerprint(config.apiKey),
      outcome,
      error_class: error?.failureClass || null,
      error_code: error?.code || null,
      status_code: error?.status || null,
      latency_ms: Date.now() - startedAt,
      input_chars: prompt.length,
      output_chars: outputChars,
      attempt_no: attempt
    });
  } catch (usageError) {
    console.warn('[CROX AI] Usage event could not be persisted.');
  }
}

async function generateWithFailover(prompt: string, configs: ProviderConfig[], userId?: number, fallbackEnabled = true): Promise<AITextResult> {
  let lastError: AIProviderRequestError | null = null;
  let totalAttempts = 0;
  const providerNames = [...new Set(configs.map(config => config.provider))];

  for (const providerName of providerNames) {
    const providerConfigs = configs.filter(config => config.provider === providerName);
    let providerSucceeded = false;
    let rotateProvider = false;

    for (const config of providerConfigs) {
      if (isProviderKeyCoolingDown(config)) {
        lastError = lastError || new AIProviderRequestError(`${providerName} is in a short cooldown after a recent provider failure.`, { failureClass: 'temporary' });
        continue;
      }
      // A 401 means this credential is invalid/revoked; trying another explicitly
      // configured credential is allowed. Quota/rate-limit failures never rotate keys
      // within the same provider, because keys may share one organisation quota.
      for (let retryIndex = 0; retryIndex <= MAX_INLINE_RETRIES; retryIndex++) {
        const startedAt = Date.now();
        totalAttempts++;
        try {
          const result = await callProvider(config, prompt);
          recordAttempt(config, 'success', startedAt, prompt, totalAttempts, undefined, result.text.length);
          providerSucceeded = true;
          result.fallback_used = totalAttempts > 1 || providerNames.indexOf(providerName) > 0;
          result.attempts = totalAttempts;
          return result;
        } catch (unknownError) {
          const error = normalizeUnknownError(unknownError, config);
          lastError = error;
          recordAttempt(config, 'failed', startedAt, prompt, totalAttempts, error, 0);
          console.warn(`[CROX AI] ${providerName} attempt failed (${error.failureClass}${error.status ? ` / ${error.status}` : ''}).`);

          if (error.failureClass === 'authentication') {
            // Move to the next key for the same provider, if present.
            break;
          }
          if (error.failureClass === 'policy' || error.failureClass === 'fatal') {
            // Never route around safety, regional, policy, permission or malformed-request refusals.
            throw error;
          }
          if (error.failureClass === 'quota' || error.failureClass === 'rate_limit') {
            const delay = retryDelay(error, retryIndex);
            if (error.failureClass === 'rate_limit' && retryIndex < MAX_INLINE_RETRIES && delay !== null) {
              await wait(delay);
              continue;
            }
            coolDownProviderKeys(providerConfigs, error.failureClass, error.retryAfterMs);
            rotateProvider = true;
            break;
          }
          if (error.failureClass === 'temporary') {
            if (retryIndex < MAX_INLINE_RETRIES) {
              const delay = retryDelay(error, retryIndex);
              if (delay !== null) {
                await wait(delay);
                continue;
              }
            }
            coolDownProviderKeys(providerConfigs, 'temporary', error.retryAfterMs);
            rotateProvider = true;
            break;
          }
        }
      }
      if (providerSucceeded || rotateProvider) break;
    }

    if (providerSucceeded) break;
    if (rotateProvider) {
      if (!fallbackEnabled) break;
      continue;
    }
    // Every key for this provider failed authentication; continue only to the next
    // separately configured provider, without ever exposing the failed credential.
    if (!fallbackEnabled) break;
  }

  if (lastError) {
    const prefix = lastError.failureClass === 'quota' ? 'Provider quota or billing limit reached.'
      : lastError.failureClass === 'rate_limit' ? 'Provider rate limit reached.'
      : lastError.failureClass === 'temporary' ? 'Provider temporarily unavailable after a bounded retry.'
      : 'AI provider request failed.';
    throw new Error(`${prefix} ${lastError.message}`.slice(0, 320));
  }
  throw new Error('No configured AI provider. Add an authorized provider API key in Settings or server environment variables.');
}

/** Server-only generation gateway. Keys are read from environment secrets or encrypted account storage. */
export async function generateAIText(prompt: string, userId?: number, providerOverride?: AIProviderName): Promise<AITextResult> {
  const cleanPrompt = String(prompt || '').trim();
  if (!cleanPrompt) throw new Error('AI prompt cannot be empty.');
  if (cleanPrompt.length > 60_000) throw new Error('AI prompt is too long. Limit prompts to 60,000 characters.');
  const configs = configsForUser(userId, providerOverride);
  if (!configs.length) throw new Error('No configured AI provider. Add an API key in Settings → AI Providers.');
  const user = userId ? db.findUserById(userId) : undefined;
  const fallbackEnabled = providerOverride ? false : user?.settings?.aiProviderFallback !== false;
  return withRequestCache<AITextResult>(
    'ai:multi-provider-failover',
    {
      userId: userId || 0,
      providers: configs.map(config => `${config.provider}:${secretFingerprint(config.apiKey)}:${config.model}`),
      prompt: cleanPrompt
    },
    () => generateWithFailover(cleanPrompt, configs, userId, fallbackEnabled),
    { ttlEnvVar: 'AI_CACHE_TTL_SECONDS', defaultTtlSeconds: 180, maxEntries: 500 }
  );
}

export async function testAIProvider(provider: UserFacingAIProvider, userId: number): Promise<{ ok: true; provider: AIProviderName; model: string; reply: string; attempts: number }> {
  const configs = configsForUser(userId, provider);
  if (!configs.length) throw new Error(`No ${provider} API key is configured for this account or server.`);
  const result = await generateWithFailover('Reply with exactly: CROX connection successful.', configs, userId, false);
  return { ok: true, provider: result.provider, model: result.model || configs.find(item => item.provider === result.provider)?.model || '', reply: result.text.slice(0, 120), attempts: result.attempts || 1 };
}

export function getAIProviderUsage(userId: number, days = 30) {
  return db.getAIProviderUsage(userId, days);
}

export function getProviderDefinition(provider: string) {
  return providerDefinitions.find(item => item.provider === provider);
}

export function getDefaultAIProviderOrder(): UserFacingAIProvider[] { return [...defaultOrder]; }

export function getAIProviderStatus(userId?: number): AIProviderStatus {
  const config = configsForUser(userId)[0];
  if (!config) {
    return { provider: 'demo', configured: false, mode: 'demo', model: 'crox-local-guidance', note: 'No AI provider key is configured for this account or server. NOVA uses local guidance until a provider is connected.' };
  }
  const providerCount = [...new Set(configsForUser(userId).map(item => item.provider))].length;
  return { provider: config.provider, configured: true, mode: 'live', model: config.model, note: `${providerCount} AI provider(s) are ready. NOVA retries temporary failures within bounded limits and can switch providers when quota or availability requires it.` };
}

export function getAIProviderSettings(userId: number): { providers: AIProviderSetting[]; order: UserFacingAIProvider[]; fallback_enabled: boolean; encryption_ready: boolean } {
  const user = db.findUserById(userId);
  const order = providerOrder(userId).filter((name): name is UserFacingAIProvider => name !== 'hermes');
  const providers = providerDefinitions.map(meta => {
    const saved = db.getUserAICredential(userId, meta.provider);
    const serverKeys = environmentKeys(meta);
    const enabled = Boolean((saved?.enabled || false) || serverKeys.length > 0);
    const source: AIProviderSetting['source'] = saved && serverKeys.length ? 'mixed' : saved ? 'account' : serverKeys.length ? 'server' : 'none';
    return {
      provider: meta.provider,
      label: meta.label,
      configured: enabled,
      enabled: Boolean(enabled),
      source,
      model: saved?.model || environmentConfigs(meta.provider)[0]?.model || meta.model,
      key_hint: saved ? 'Account key stored securely' : serverKeys.length ? 'Server environment secrets' : '',
      key_count: (saved?.enabled ? 1 : 0) + serverKeys.length,
      updated_at: saved?.updated_at
    } as AIProviderSetting;
  });
  const hasEncryptionSecret = String(process.env.AI_KEYS_ENCRYPTION_SECRET || process.env.JWT_SECRET || '').trim().length >= 32;
  return { providers, order, fallback_enabled: user?.settings?.aiProviderFallback !== false, encryption_ready: hasEncryptionSecret };
}
