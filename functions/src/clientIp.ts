// RF-4 (016), RF-5 (016), D-T7 (016) · IP de quien llama para los límites por origen. La entrada de más a la derecha de
// `X-Forwarded-For` es la que agrega el frente de Google; las de la izquierda las puede escribir quien llama.
import { isIP } from 'node:net';

export interface IpRequest {
  headers: Record<string, string | string[] | undefined>;
  ip?: string | undefined;
}

const MAPPED_V4 = /^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/i;

/** Los ocho grupos de una IPv6 válida, sin la zona (`%eth0`). */
function groupsOf(ip: string): string[] {
  const [head = '', tail] = ip.split('%')[0]!.toLowerCase().split('::');
  const left = head === '' ? [] : head.split(':');
  const right = tail === undefined || tail === '' ? [] : tail.split(':');
  const zeros = tail === undefined ? [] : Array<string>(8 - left.length - right.length).fill('0');
  return [...left, ...zeros, ...right].map((group) => parseInt(group, 16).toString(16));
}

/** Una IPv4 tal cual; una IPv4 mapeada en IPv6, como IPv4; una IPv6, reducida a su /64 (una conexión doméstica). */
function normalize(ip: string): string {
  const mapped = MAPPED_V4.exec(ip);
  if (mapped !== null && isIP(mapped[1]!) === 4) return mapped[1]!;
  if (isIP(ip) !== 6) return ip;
  return `${groupsOf(ip).slice(0, 4).join(':')}::/64`;
}

/** IP del cliente, o `undefined` si no hay ninguna (D-T7 (016)). */
export function clientIpOf(req: IpRequest): string | undefined {
  const raw = req.headers['x-forwarded-for'];
  const header = Array.isArray(raw) ? raw.join(',') : raw;
  const last = header
    ?.split(',')
    .map((entry) => entry.trim())
    .filter((entry) => entry !== '')
    .at(-1);
  const ip = last !== undefined && isIP(last) !== 0 ? last : req.ip;
  return ip === undefined || ip === '' ? undefined : normalize(ip);
}
