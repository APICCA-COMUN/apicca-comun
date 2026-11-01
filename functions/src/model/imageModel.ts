// Puerto del modelo de imágenes (D-T7 (001)): el servidor depende de esto y no del proveedor.
// El adaptador real (`openRouterImageModel`, D-T22 (001)) y el doble de pruebas lo implementan.

export interface ImageRequest {
  prompt: string;
  /** Imágenes de referencia ya validadas, en bytes. */
  references: Uint8Array[];
}

export interface ImageModel {
  generate(request: ImageRequest): Promise<Uint8Array>;
}

/**
 * Por qué falló la generación (RF-20 (001)): `failure` (error del proveedor o de red), `timeout`
 * (no respondió a tiempo), `empty` (sin imagen utilizable) y `rejected` (el modelo rechazó la
 * descripción o las referencias).
 */
export type ImageModelErrorKind = 'failure' | 'timeout' | 'empty' | 'rejected';

export class ImageModelError extends Error {
  readonly kind: ImageModelErrorKind;

  constructor(kind: ImageModelErrorKind, message?: string) {
    super(message ?? `Falló el modelo de imágenes: ${kind}`);
    this.name = 'ImageModelError';
    this.kind = kind;
  }
}

export type FakeBehavior = { image: Uint8Array } | { error: ImageModelErrorKind };

export interface FakeImageModel extends ImageModel {
  /** Peticiones recibidas, en orden. */
  readonly requests: ImageRequest[];
  /** Cambia lo que responderá de ahí en adelante. */
  setBehavior(behavior: FakeBehavior): void;
}

/** Doble de pruebas configurable: no gasta ni sale a la red. Un resultado vacío es el error `empty`. */
export function createFakeImageModel(initial: FakeBehavior): FakeImageModel {
  let behavior = initial;
  const requests: ImageRequest[] = [];
  return {
    requests,
    setBehavior(next) {
      behavior = next;
    },
    generate(request) {
      requests.push(request);
      if ('error' in behavior) return Promise.reject(new ImageModelError(behavior.error));
      if (behavior.image.length === 0) return Promise.reject(new ImageModelError('empty'));
      return Promise.resolve(behavior.image);
    },
  };
}
