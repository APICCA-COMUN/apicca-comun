// Aplica y comprueba la plantilla del correo de restablecer contraseña (RF-12 (002), D-T15 (002)).
// Lo ejecuta la persona, con `--project` explícito y tras confirmar el objetivo, igual que un despliegue.
//
// Uso (desde functions/):
//   npm run apply-auth-templates -- --project apicca-com [--with-body]   aplica tras mostrar el diff
//   npm run apply-auth-templates -- --project apicca-com --check [--with-body]   solo compara
// Siempre fija remitente y asunto; el cuerpo solo con --with-body, cuando T-0.1 (002) confirmó que es
// editable (RF-12 (002) · 12.3). El token sale de GOOGLE_ACCESS_TOKEN o de `gcloud auth print-access-token`.
import { execFileSync } from 'node:child_process';
import { createInterface } from 'node:readline/promises';
import { resetEmail } from '../../shared/domain/identity/resetEmail';

const BASE = 'https://identitytoolkit.googleapis.com/admin/v2/projects';
const TEMPLATE_PATH = 'notification.sendEmail.resetPasswordTemplate';

export interface HttpClient {
  get(url: string): Promise<Record<string, unknown>>;
  patch(url: string, body: unknown): Promise<unknown>;
}

export interface Deps {
  http: HttpClient;
  confirm(question: string): Promise<boolean>;
  log(line: string): void;
}

type Field = 'senderDisplayName' | 'subject' | 'body' | 'bodyFormat';

export interface Plan {
  url: string;
  getUrl: string;
  updateMask: string;
  body: { notification: { sendEmail: { resetPasswordTemplate: Partial<Record<Field, string>> } } };
  fields: Partial<Record<Field, string>>;
}

export function buildPlan(project: string, withBody: boolean): Plan {
  const t = resetEmail();
  const fields: Partial<Record<Field, string>> = { senderDisplayName: t.senderName, subject: t.subject };
  if (withBody) {
    fields.body = t.body;
    fields.bodyFormat = 'HTML';
  }
  const updateMask = Object.keys(fields).map((field) => `${TEMPLATE_PATH}.${field}`).join(',');
  const getUrl = `${BASE}/${encodeURIComponent(project)}/config`;
  return {
    url: `${getUrl}?updateMask=${encodeURIComponent(updateMask).replace(/%2C/g, ',')}`,
    getUrl,
    updateMask,
    body: { notification: { sendEmail: { resetPasswordTemplate: fields } } },
    fields,
  };
}

function currentTemplate(config: Record<string, unknown>): Partial<Record<Field, string>> {
  const notification = config['notification'] as { sendEmail?: { resetPasswordTemplate?: Record<string, unknown> } } | undefined;
  const raw = notification?.sendEmail?.resetPasswordTemplate ?? {};
  const out: Partial<Record<Field, string>> = {};
  for (const field of ['senderDisplayName', 'subject', 'body', 'bodyFormat'] as const) {
    const value = raw[field];
    if (typeof value === 'string') out[field] = value;
  }
  return out;
}

function differences(plan: Plan, current: Partial<Record<Field, string>>): Field[] {
  return (Object.keys(plan.fields) as Field[]).filter((field) => plan.fields[field] !== current[field]);
}

function option(args: string[], flag: string): string | undefined {
  const at = args.indexOf(flag);
  return at === -1 ? undefined : args[at + 1];
}

export async function runApplyAuthTemplates(args: string[], deps: Deps): Promise<number> {
  const { http, confirm, log } = deps;
  const project = option(args, '--project');
  if (!project || project.startsWith('--')) {
    log('Falta --project: indica el proyecto de forma explícita (por ejemplo, --project apicca-com).');
    return 1;
  }
  const plan = buildPlan(project, args.includes('--with-body'));
  const current = currentTemplate(await http.get(plan.getUrl));
  const diff = differences(plan, current);

  if (args.includes('--check')) {
    if (diff.length === 0) {
      log(`La plantilla de ${project} coincide con el repositorio.`);
      return 0;
    }
    log(`La plantilla de ${project} difiere del repositorio en: ${diff.join(', ')}.`);
    return 1;
  }

  log(`Proyecto: ${project}`);
  log(`updateMask: ${plan.updateMask}`);
  for (const field of Object.keys(plan.fields) as Field[]) {
    const state = diff.includes(field) ? 'cambia' : 'igual';
    log(`- ${field} (${state})`);
    if (state === 'cambia') {
      log(`    actual: ${current[field] ?? '(vacío)'}`);
      log(`    nuevo:  ${plan.fields[field]}`);
    }
  }
  if (!(await confirm(`¿Aplicar la plantilla en el proyecto ${project}?`))) {
    log('Cancelado: no se hizo ningún cambio.');
    return 1;
  }
  await http.patch(plan.url, plan.body);
  log('Plantilla aplicada. Corre de nuevo con --check para comprobarla.');
  return 0;
}

function accessToken(): string {
  const fromEnv = process.env['GOOGLE_ACCESS_TOKEN'];
  if (fromEnv) return fromEnv;
  return execFileSync('gcloud', ['auth', 'print-access-token'], { encoding: 'utf8' }).trim();
}

function realHttp(project: string): HttpClient {
  const headers = () => ({
    Authorization: `Bearer ${accessToken()}`,
    'Content-Type': 'application/json',
    'X-Goog-User-Project': project,
  });
  async function call(url: string, init: RequestInit): Promise<unknown> {
    const response = await fetch(url, { ...init, headers: headers() });
    if (!response.ok) throw new Error(`Identity Toolkit respondió ${response.status}: ${await response.text()}`);
    return response.json();
  }
  return {
    get: async (url) => (await call(url, { method: 'GET' })) as Record<string, unknown>,
    patch: (url, body) => call(url, { method: 'PATCH', body: JSON.stringify(body) }),
  };
}

async function main(args: string[]): Promise<number> {
  const project = option(args, '--project') ?? '';
  return runApplyAuthTemplates(args, {
    http: realHttp(project),
    log: (line) => console.log(line),
    confirm: async (question) => {
      const rl = createInterface({ input: process.stdin, output: process.stdout });
      const answer = await rl.question(`${question} (s/N) `);
      rl.close();
      return /^(s|sí|si|y|yes)$/i.test(answer.trim());
    },
  });
}

if (typeof require !== 'undefined' && require.main === module) {
  main(process.argv.slice(2)).then(
    (code) => process.exit(code),
    (error: unknown) => {
      console.error(error instanceof Error ? error.message : error);
      process.exit(1);
    },
  );
}
