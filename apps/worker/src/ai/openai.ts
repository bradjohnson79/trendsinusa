type OpenAITextOptions = {
  // NOTE: model is accepted for call-site compatibility, but is ignored.
  model: string;
  system: string;
  user: string;
  temperature?: number;
  maxOutputTokens?: number;
};

function getKey(): string {
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new Error('Missing OPENAI_API_KEY');
  return key;
}

async function postJson<T>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${getKey()}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`OpenAI error ${res.status}: ${text}`);
  }

  return (await res.json()) as T;
}

export const AI_TEXT_MODEL = 'gpt-4.1-nano' as const;

export async function generateShortText(opts: OpenAITextOptions): Promise<string> {
  // Hard constraints (cost + safety):
  // - Model: gpt-4.1-nano ONLY
  // - Short outputs only (no long-form generation)
  const max = Math.max(1, Math.min(180, Math.trunc(opts.maxOutputTokens ?? 80)));

  const data = await postJson<{
    choices: Array<{ message: { content: string } }>;
  }>('https://api.openai.com/v1/chat/completions', {
    model: AI_TEXT_MODEL,
    temperature: opts.temperature ?? 0,
    max_tokens: max,
    messages: [
      { role: 'system', content: opts.system },
      { role: 'user', content: opts.user },
    ],
  });

  const content = data.choices?.[0]?.message?.content ?? '';
  return content.trim();
}

// Permanent policy: no image generation APIs.
export async function generatePromoImage(): Promise<never> {
  throw new Error('image_generation_disabled');
}
