// Adaptador real del puerto `ImageModel` (D-T22 (001), RF-17 (001)): OpenRouter, con `fetch`, sin SDK.
// La llave llega del secreto `OPENROUTER_API_KEY` (la inyecta quien lo construye) y el modelo es
// configuración (D-T7 (001)). La forma de la API vigente se verificó el 7 de octubre de 2026 y está
// anotada en plan.md (D-T22 (001)).
import { GENERATION_TIMEOUT_MS } from '../../../shared/domain/generation';
import { ImageModelError, type ImageModel, type ImageModelErrorKind, type ImageRequest } from './imageModel';

export const OPENROUTER_IMAGES_URL = 'https://openrouter.ai/api/v1/images';

export interface OpenRouterConfig {
  /** Valor del secreto `OPENROUTER_API_KEY`. */
  apiKey: string;
  /** Identificador del modelo de imágenes en OpenRouter (configuración, no constante). */
  model: string;
  /** Solo para pruebas. */
  fetch?: typeof fetch;
  /** Por defecto, `GENERATION_TIMEOUT_MS` (90 s, RF-20 (001)). */
  timeoutMs?: number;
}

function mediaTypeOf(bytes: Uint8Array): string {
  if (bytes[0] === 0xff && bytes[1] === 0xd8) return 'image/jpeg';
  if (bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46) return 'image/webp';
  return 'image/png';
}

const toDataUrl = (bytes: Uint8Array): string =>
  `data:${mediaTypeOf(bytes)};base64,${Buffer.from(bytes).toString('base64')}`;

/** Estado HTTP → tipo de falla (RF-20 (001)): 400 es rechazo del modelo; 524 y 504, tiempo. */
function kindForStatus(status: number): ImageModelErrorKind {
  if (status === 400) return 'rejected';
  if (status === 504 || status === 524) return 'timeout';
  return 'failure';
}

export function createOpenRouterImageModel(config: OpenRouterConfig): ImageModel {
  const doFetch = config.fetch ?? fetch;
  const timeoutMs = config.timeoutMs ?? GENERATION_TIMEOUT_MS;

  return {
    async generate(request: ImageRequest): Promise<Uint8Array> {
      const body: Record<string, unknown> = {
        model: config.model,
        prompt: request.prompt,
        n: 1,
        aspect_ratio: '1:1',
        resolution: '512',
        output_format: 'png',
      };
      if (request.references.length > 0) {
        body['input_references'] = request.references.map((bytes) => ({
          type: 'image_url',
          image_url: { url: toDataUrl(bytes) },
        }));
      }

      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      try {
        const response = await doFetch(OPENROUTER_IMAGES_URL, {
          method: 'POST',
          headers: { Authorization: `Bearer ${config.apiKey}`, 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
          signal: controller.signal,
        });
        // El texto del error del proveedor no se reenvía: puede repetir datos de la petición.
        if (!response.ok) throw new ImageModelError(kindForStatus(response.status), `OpenRouter respondió ${response.status}`);
        const json = (await response.json()) as { data?: { b64_json?: unknown }[] };
        const b64 = json.data?.[0]?.b64_json;
        if (typeof b64 !== 'string' || b64.length === 0) throw new ImageModelError('empty');
        const bytes = new Uint8Array(Buffer.from(b64, 'base64'));
        if (bytes.length === 0) throw new ImageModelError('empty');
        return bytes;
      } catch (error) {
        if (error instanceof ImageModelError) throw error;
        if (controller.signal.aborted) throw new ImageModelError('timeout');
        throw new ImageModelError('failure');
      } finally {
        clearTimeout(timer);
      }
    },
  };
}
