// Pruebas del script de plantillas de Auth, sin credenciales ni red (RF-12 (002) · 12.1, 12.3; D-T15 (002)).
import { describe, expect, it, vi } from 'vitest';
import { resetEmail } from '../../shared/domain/identity/resetEmail';
import { runApplyAuthTemplates, type HttpClient } from './apply-auth-templates';

const PATH = 'notification.sendEmail.resetPasswordTemplate';
const template = resetEmail();

function fakeHttp(current: Record<string, unknown> = {}): HttpClient & { get: ReturnType<typeof vi.fn>; patch: ReturnType<typeof vi.fn> } {
  return {
    get: vi.fn(async () => current),
    patch: vi.fn(async () => ({})),
  };
}

function setup(argv: string[], current: Record<string, unknown> = {}, answer = true) {
  const http = fakeHttp(current);
  const confirm = vi.fn(async () => answer);
  const out: string[] = [];
  const log = (line: string) => out.push(line);
  const run = () => runApplyAuthTemplates(argv, { http, confirm, log });
  return { http, confirm, out, run };
}

const sameConfig = {
  notification: {
    sendEmail: {
      resetPasswordTemplate: {
        senderDisplayName: template.senderName,
        subject: template.subject,
        body: template.body,
        bodyFormat: 'HTML',
      },
    },
  },
};

describe('apply-auth-templates · aplicar', () => {
  it('RF-12 (002) · 12.3: sin cuerpo editable fija solo remitente y asunto', async () => {
    const t = setup(['--project', 'apicca-com']);
    expect(await t.run()).toBe(0);
    expect(t.http.patch).toHaveBeenCalledTimes(1);
    const [url, body] = t.http.patch.mock.calls[0]!;
    const parsed = new URL(url as string);
    expect(parsed.origin + parsed.pathname).toBe('https://identitytoolkit.googleapis.com/admin/v2/projects/apicca-com/config');
    expect(parsed.searchParams.get('updateMask')).toBe(`${PATH}.senderDisplayName,${PATH}.subject`);
    expect(body).toEqual({
      notification: { sendEmail: { resetPasswordTemplate: { senderDisplayName: template.senderName, subject: template.subject } } },
    });
  });

  it('RF-12 (002) · 12.1: con --with-body suma el cuerpo HTML y su formato al updateMask', async () => {
    const t = setup(['--project', 'apicca-com', '--with-body']);
    expect(await t.run()).toBe(0);
    const [url, body] = t.http.patch.mock.calls[0]!;
    expect(new URL(url as string).searchParams.get('updateMask')).toBe(
      `${PATH}.senderDisplayName,${PATH}.subject,${PATH}.body,${PATH}.bodyFormat`,
    );
    expect(body).toEqual({
      notification: {
        sendEmail: {
          resetPasswordTemplate: { senderDisplayName: template.senderName, subject: template.subject, body: template.body, bodyFormat: 'HTML' },
        },
      },
    });
  });

  it('RF-12 (002) · 12.3: sin --project no hace ninguna petición', async () => {
    const t = setup([]);
    expect(await t.run()).not.toBe(0);
    expect(t.http.get).not.toHaveBeenCalled();
    expect(t.http.patch).not.toHaveBeenCalled();
    expect(t.confirm).not.toHaveBeenCalled();
    expect(t.out.join('\n')).toContain('--project');
  });

  it('RF-12 (002) · 12.3: muestra el diff y, si no se confirma, no aplica', async () => {
    const t = setup(['--project', 'apicca-com'], { notification: { sendEmail: { resetPasswordTemplate: { subject: 'Viejo' } } } }, false);
    expect(await t.run()).not.toBe(0);
    expect(t.confirm).toHaveBeenCalledTimes(1);
    expect(t.http.patch).not.toHaveBeenCalled();
    const text = t.out.join('\n');
    expect(text).toContain('Viejo');
    expect(text).toContain(template.subject);
  });
});

describe('apply-auth-templates · --check', () => {
  it('RF-12 (002) · 12.1: --check pasa con la configuración igual y no escribe', async () => {
    const t = setup(['--project', 'apicca-com', '--check', '--with-body'], sameConfig);
    expect(await t.run()).toBe(0);
    expect(t.http.get).toHaveBeenCalledTimes(1);
    expect(t.http.patch).not.toHaveBeenCalled();
    expect(t.confirm).not.toHaveBeenCalled();
  });

  it('RF-12 (002) · 12.1: --check falla si el asunto difiere', async () => {
    const changed = structuredClone(sameConfig);
    changed.notification.sendEmail.resetPasswordTemplate.subject = 'Otro asunto';
    const t = setup(['--project', 'apicca-com', '--check', '--with-body'], changed);
    expect(await t.run()).not.toBe(0);
    expect(t.out.join('\n')).toContain('subject');
    expect(t.http.patch).not.toHaveBeenCalled();
  });

  it('RF-12 (002) · 12.3: --check sin --with-body ignora el cuerpo', async () => {
    const changed = structuredClone(sameConfig);
    changed.notification.sendEmail.resetPasswordTemplate.body = 'otro cuerpo';
    const t = setup(['--project', 'apicca-com', '--check'], changed);
    expect(await t.run()).toBe(0);
  });

  it('RF-12 (002) · 12.1: --check con --with-body falla si el cuerpo difiere', async () => {
    const changed = structuredClone(sameConfig);
    changed.notification.sendEmail.resetPasswordTemplate.body = 'otro cuerpo';
    const t = setup(['--project', 'apicca-com', '--check', '--with-body'], changed);
    expect(await t.run()).not.toBe(0);
  });

  it('RF-12 (002) · 12.3: --check sin --project no hace petición', async () => {
    const t = setup(['--check']);
    expect(await t.run()).not.toBe(0);
    expect(t.http.get).not.toHaveBeenCalled();
  });
});
