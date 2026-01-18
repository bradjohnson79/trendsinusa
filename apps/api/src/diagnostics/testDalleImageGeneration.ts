import type { AdminDalleDiagnosticsResponse } from '@trendsinusa/shared/api';

/**
 * Permanent policy: no image-generation APIs (DALL·E / gpt-image-1).
 *
 * We keep the diagnostic endpoint returning a structured PASS/FAIL response,
 * but it always fails closed with an explicit error.
 */
export async function testDalleImageGeneration(): Promise<AdminDalleDiagnosticsResponse> {
  return {
    success: false,
    error: {
      message: 'image_generation_disabled',
      httpStatus: null,
      kind: 'bad_request',
      raw: null,
    },
    model: 'disabled',
    size: '1024x1024',
    elapsedMs: 0,
    image: null,
    responseMeta: { disabled: true },
  };
}
