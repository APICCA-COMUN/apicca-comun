// RF-3 (016), D-T6 (016): topes de instancias y concurrencia de las callables, leídos de su declaración.
import { describe, expect, it } from 'vitest';
import { api, media } from './index';

type Endpoint = { maxInstances?: number; concurrency?: number; cpu?: number | string; secretEnvironmentVariables?: { key: string }[] };
const endpointOf = (fn: unknown): Endpoint => (fn as { __endpoint: Endpoint }).__endpoint;

describe('functions/index · topes', () => {
  it('RF-3 (016) · 3.1: api tiene un máximo de 10 instancias', () => {
    expect(endpointOf(api).maxInstances).toBe(10);
  });

  it('RF-3 (016) · 3.2: media tiene un máximo de 3 instancias, con 1 CPU y 4 llamadas a la vez', () => {
    const endpoint = endpointOf(media);
    expect(endpoint.maxInstances).toBe(3);
    expect(endpoint.cpu).toBe(1);
    expect(endpoint.concurrency).toBe(4);
  });

  it('RF-5 (016): media recibe la sal del hash de IP para el tope de lecturas anónimas', () => {
    expect(endpointOf(media).secretEnvironmentVariables?.map((s) => s.key)).toContain('IP_HASH_SALT');
  });
});
