import type { ImageProvider } from '../provider.js';

/**
 * Permanent policy: no authenticated image providers.
 * This provider remains as a stub to keep historical imports from breaking.
 */
export class DalleImageProvider implements ImageProvider {
  async generate(): Promise<Buffer> {
    throw new Error('image_generation_disabled');
  }
}
