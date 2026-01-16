import 'server-only';

type OpenAITextOptions = {
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
    cache: 'no-store',
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`OpenAI error ${res.status}: ${text}`);
  }

  return (await res.json()) as T;
}

export async function generateShortText(opts: OpenAITextOptions): Promise<string> {
  const data = await postJson<{
    choices: Array<{ message: { content: string } }>;
  }>('https://api.openai.com/v1/chat/completions', {
    model: opts.model,
    temperature: opts.temperature ?? 0.4,
    max_tokens: opts.maxOutputTokens ?? 80,
    messages: [
      { role: 'system', content: opts.system },
      { role: 'user', content: opts.user },
    ],
  });

  const content = data.choices?.[0]?.message?.content ?? '';
  return content.trim();
}

