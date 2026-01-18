export type ImageProviderGenerateOptions = {
  prompt: string;
  // The provider’s native generation size (not the derived Sharp sizes).
  // We keep this intentionally narrow to match existing OpenAI helper typing.
  size?: '1024x1024' | '1024x1792' | '1792x1024';
};

export interface ImageProvider {
  generate(opts: ImageProviderGenerateOptions): Promise<Buffer>;
}

