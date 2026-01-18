import { generatePromoImage } from '../../ai/openai.js';
import type { ImageProvider, ImageProviderGenerateOptions } from '../provider.js';

async function downloadToBuffer(url: string): Promise<Buffer> {
  const res = await fetch(url);
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Failed to download image (${res.status}): ${text.slice(0, 200)}`);
  }
  const arr = await res.arrayBuffer();
  return Buffer.from(arr);
}

function withNoLogoPolicy(prompt: string) {
  // Provider-level safety: default deny list to avoid brand/logos/trademarks.
  // (The caller can still override by providing a different prompt, but this is the default behavior.)
  return `Rules (must follow):
- No logos, no trademarks, no brand names
- No text, no letters, no numbers, no watermarks
- No UI elements, no app screenshots

Prompt:
${prompt}`.trim();
}

export class DalleImageProvider implements ImageProvider {
  async generate(opts: ImageProviderGenerateOptions): Promise<Buffer> {
    const model = process.env.AI_IMAGE_MODEL ?? 'dall-e-3';
    const prompt = withNoLogoPolicy(opts.prompt);
    const url = await generatePromoImage({ model, prompt, size: opts.size ?? '1024x1024' });
    return await downloadToBuffer(url);
  }
}

