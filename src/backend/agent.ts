export interface AgentPayload {
  message: string;
  context?: Record<string, unknown>;
}

export interface AgentResult {
  used: boolean;
  reply?: string;
  error?: string;
}

export function agentConfigured(): boolean {
  return !!(process.env.AGENT_API_URL || '').trim();
}

export async function callExternalAgent(payload: AgentPayload): Promise<AgentResult> {
  const url = (process.env.AGENT_API_URL || '').trim();
  const key = (process.env.AGENT_API_KEY || '').trim();
  if (!url) return { used: false };

  try {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Accept: 'application/json'
    };
    if (key) headers.Authorization = `Bearer ${key}`;

    const res = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        message: payload.message,
        context: payload.context || {},
        product: 'CROX',
        assistant: 'NOVA'
      }),
      signal: AbortSignal.timeout(25000)
    });
    const body: any = await res.json().catch(() => null);
    if (!res.ok) {
      return { used: true, error: typeof body?.detail === 'string' ? body.detail : `External agent returned HTTP ${res.status}.` };
    }
    const reply = String(body?.reply || body?.message || body?.output || '').trim();
    if (!reply) return { used: true, error: 'The connected agent returned an empty response.' };
    return { used: true, reply };
  } catch (err: any) {
    const timedOut = err?.name === 'TimeoutError' || err?.name === 'AbortError';
    return { used: true, error: timedOut ? 'The connected agent timed out.' : 'Could not reach the connected agent.' };
  }
}
