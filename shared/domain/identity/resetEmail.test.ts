// Pruebas de la plantilla del correo de restablecer contraseña (RF-12 (002), RNF-3 (002), D-T15 (002)).
// RF-2 (003) · 2.5, D-25 (003), D-T2 (003): el fondo del cuerpo toma el background claro nuevo (Niebla).
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { resetEmail } from './resetEmail';
import { TOKENS } from './tokens';

describe('resetEmail', () => {
  const mail = resetEmail();

  it('RF-12 (002) · 12.1: devuelve remitente, asunto y cuerpo como texto no vacío', () => {
    for (const value of [mail.senderName, mail.subject, mail.body]) {
      expect(typeof value).toBe('string');
      expect(value.length).toBeGreaterThan(0);
    }
  });

  it('RF-12 (002) · 12.2: el remitente conserva sus tildes y el texto está en español', () => {
    expect(mail.senderName).toContain('APICCA COMÚN');
    expect(mail.subject).toMatch(/contraseña/i);
    expect(mail.body).toMatch(/contraseña/i);
    expect(mail.body).toContain('<html lang="es"');
  });

  it('RF-12 (002) · 12.2: el cuerpo lleva los marcadores de Firebase', () => {
    expect(mail.body).toContain('%LINK%');
    expect(mail.body).toContain('%APP_NAME%');
    expect(mail.body).toContain('%EMAIL%');
  });

  it('RF-12 (002) · 12.2: %EMAIL% va en un párrafo con word-break: break-word', () => {
    expect(mail.body).toMatch(/<p[^>]*word-break:\s*break-word[^>]*>[^<]*%EMAIL%/);
  });

  it('RF-12 (002) · 12.2: el logo viene de apicca.com con alt APICCA COMÚN', () => {
    expect(mail.body).toMatch(/<img[^>]*src="https:\/\/apicca\.com\/brand\/logo\.png"/);
    expect(mail.body).toMatch(/<img[^>]*alt="APICCA COMÚN"/);
  });

  it('RF-12 (002) · 12.2: usa los colores de TOKENS.light, también como atributos bgcolor', () => {
    const light = TOKENS.light;
    for (const name of ['background', 'surface', 'text', 'action-blue', 'on-accent'] as const) {
      expect(mail.body.toLowerCase()).toContain(light[name].toLowerCase());
    }
    expect(mail.body).toContain(`bgcolor="${light.background}"`);
    expect(mail.body).toContain(`bgcolor="${light.surface}"`);
    expect(mail.body).toContain(`bgcolor="${light['action-blue']}"`);
  });

  it('RF-12 (002) · 12.2: declara color-scheme light only', () => {
    expect(mail.body).toContain('<meta name="color-scheme" content="light only">');
    expect(mail.body).toContain('color-scheme: light only');
  });

  it('RNF-3 (002): ninguna URL del correo sale de apicca.com, salvo el marcador %LINK%', () => {
    const urls = mail.body.match(/https?:\/\/[^\s"'<>)]+/g) ?? [];
    expect(urls.length).toBeGreaterThan(0);
    for (const url of urls) {
      expect(new URL(url).hostname).toBe('apicca.com');
    }
  });

  it('RF-2 (003) · 2.5: el fondo del cuerpo es Niebla (#E8E7EC), leído de TOKENS.light.background', () => {
    expect(TOKENS.light.background).toBe('#E8E7EC');
    expect(mail.body).toContain('<body bgcolor="#E8E7EC" style="margin: 0; padding: 0; background-color: #E8E7EC;');
    expect(mail.body).toContain('<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#E8E7EC"');
  });

  it('RF-2 (003) · 2.5: resetEmail.ts no tiene literales de color propios', () => {
    const source = readFileSync(new URL('./resetEmail.ts', import.meta.url), 'utf8');
    expect(source.match(/#[0-9A-Fa-f]{3,8}\b/g) ?? []).toEqual([]);
  });
});
