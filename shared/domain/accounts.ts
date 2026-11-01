// Cuentas: contraseña, nombre y nombre de usuario (RF-2 (001)), roles y estados (RF-5 (001)).
import { LIMITS, countCodePoints, isBlank } from './limits';
import { invalid, valid, type Validation } from './result';

export type Role = 'member' | 'facilitator';
export type AccountStatus = 'active' | 'suspended';

/** Documento `accounts/{uid}`: lo escribe solo el servidor (D-T3 (001)). */
export interface AccountDoc {
  email: string;
  /** Nombre real: lo ven la persona y los facilitadores (RNF-4 (001)). */
  name: string;
  username: string;
  role: Role;
  status: AccountStatus;
}

/** Nombres que nadie puede registrar (RF-2 (001)). */
export const RESERVED_USERNAMES: readonly string[] = ['facilitador', 'admin', 'apicca'];

const USERNAME_FORM = /^[a-z0-9_]+$/;

/** Al menos 8 caracteres, sin más reglas; no se recorta ni se cambia. */
export function validatePassword(password: string): Validation<string> {
  return countCodePoints(password) >= LIMITS.passwordMin ? valid(password) : invalid('password-too-short');
}

/** De 1 a 80 caracteres; los espacios de los extremos no cuentan. */
export function validateName(name: string): Validation<string> {
  const trimmed = name.trim();
  if (isBlank(trimmed) || countCodePoints(trimmed) > LIMITS.name) return invalid('name-invalid');
  return valid(trimmed);
}

/** De 3 a 24 caracteres de la a a la z, números y guion bajo, con una letra; pasa a minúsculas. */
export function validateUsername(username: string): Validation<string> {
  const lower = username.toLowerCase();
  const sizeOk = lower.length >= LIMITS.usernameMin && lower.length <= LIMITS.username;
  if (!sizeOk || !USERNAME_FORM.test(lower) || !/[a-z]/.test(lower)) return invalid('username-invalid');
  if (RESERVED_USERNAMES.includes(lower)) return invalid('username-reserved');
  return valid(lower);
}
