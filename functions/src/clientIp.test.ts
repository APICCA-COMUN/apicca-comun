// RF-4 (016), D-T7 (016): la IP del límite por origen no la elige quien llama.
import { describe, expect, it } from 'vitest';
import { clientIpOf } from './clientIp';

const req = (xff: string | string[] | undefined, ip?: string) => ({ headers: { 'x-forwarded-for': xff }, ip });

describe('clientIpOf', () => {
  it('RF-4 (016): toma la entrada de más a la derecha de X-Forwarded-For, la que agrega el frente de Google', () => {
    expect(clientIpOf(req('203.0.113.7', '10.0.0.1'))).toBe('203.0.113.7');
    expect(clientIpOf(req('1.1.1.1, 2.2.2.2, 203.0.113.7', '10.0.0.1'))).toBe('203.0.113.7');
    expect(clientIpOf(req(['1.1.1.1', '203.0.113.7'], '10.0.0.1'))).toBe('203.0.113.7');
  });

  it('RF-4 (016): un X-Forwarded-For falso a la izquierda no cambia el origen', () => {
    const real = clientIpOf(req('203.0.113.7'));
    for (const fake of ['9.9.9.9', '8.8.8.8, 7.7.7.7', 'basura', '']) {
      expect(clientIpOf(req(fake === '' ? '203.0.113.7' : `${fake}, 203.0.113.7`))).toBe(real);
    }
  });

  it('RF-4 (016): si la última entrada no es una IP o falta el encabezado, usa la IP de la conexión', () => {
    expect(clientIpOf(req('203.0.113.7, no-es-ip', '198.51.100.2'))).toBe('198.51.100.2');
    expect(clientIpOf(req(undefined, '198.51.100.2'))).toBe('198.51.100.2');
    expect(clientIpOf(req(undefined, undefined))).toBeUndefined();
  });

  it('RF-4 (016): una IPv6 se reduce a su /64 y una IPv4 mapeada queda como IPv4', () => {
    expect(clientIpOf(req('2001:db8:abcd:12:1111:2222:3333:4444'))).toBe('2001:db8:abcd:12::/64');
    expect(clientIpOf(req('2001:db8:abcd:12::9'))).toBe('2001:db8:abcd:12::/64');
    expect(clientIpOf(req('2001:DB8::1'))).toBe('2001:db8:0:0::/64');
    expect(clientIpOf(req('::ffff:203.0.113.7'))).toBe('203.0.113.7');
    expect(clientIpOf(req(undefined, '::ffff:198.51.100.2'))).toBe('198.51.100.2');
  });
});
