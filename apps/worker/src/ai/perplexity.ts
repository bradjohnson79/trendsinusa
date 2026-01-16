type PerplexityOpts = {
  model: string;
  system: string;
  user: string;
  temperature?: number;
  maxTokens?: number;
};

function getKey(): string {
  const key = process.env.PERPLEXITY_API_KEY;
  if (!key) throw new Error('Missing PERPLEXITY_API_KEY');
  return key;
}

async function postJson<T>(body: unknown): Promise<T> {
  const res = await fetch('https://api.perplexity.ai/chat/completions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${getKey()}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Perplexity error ${res.status}: ${text}`);
  }
  return (await res.json()) as T;
}

export async function perplexityResearch(opts: PerplexityOpts): Promise<string> {
  const data = await postJson<{ choices: Array<{ message: { content: string } }> }>({
    model: opts.model,
    temperature: opts.temperature ?? 0.2,
    max_tokens: opts.maxTokens ?? 700,
    messages: [
      { role: 'system', content: opts.system },
      { role: 'user', content: opts.user },
    ],
  });
  return (data.choices?.[0]?.message?.content ?? '').trim();
}

