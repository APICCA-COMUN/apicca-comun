// Alta y rescate del primer facilitador (spec §6, D-8 (001)). Lo ejecuta quien administra el
// proyecto, con credenciales de aplicación; es también la salida si no queda ningún facilitador
// que pueda entrar. Es idempotente: repetirlo con el mismo correo no duplica nada.
//
// Uso (desde functions/):
//   npm run bootstrap -- --project apicca-com --email a@b.org --name "Nombre" --username fabi
// La contraseña se lee de la variable BOOTSTRAP_PASSWORD, no de la línea de órdenes.
import { getApps, initializeApp } from 'firebase-admin/app';
import { getAuth, type Auth } from 'firebase-admin/auth';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';
import { validateName, validatePassword, validateUsername, type AccountDoc } from '../../shared/domain/accounts';
import { normalizeEmail } from '../../shared/domain/limits';
import { ApiError } from '../src/errors';

export interface BootstrapInput {
  email: string;
  password: string;
  name: string;
  username: string;
}

export async function bootstrapFacilitator(
  deps: { auth: Auth; db: Firestore },
  input: BootstrapInput,
): Promise<{ uid: string; created: boolean }> {
  const { auth, db } = deps;
  const email = normalizeEmail(input.email);
  const password = validatePassword(input.password);
  const name = validateName(input.name);
  const username = validateUsername(input.username);
  for (const result of [password, name, username]) if (!result.ok) throw new ApiError(result.code);
  if (!password.ok || !name.ok || !username.ok) return never();

  let existingUid: string | null = null;
  try {
    existingUid = (await auth.getUserByEmail(email)).uid;
  } catch (error) {
    if ((error as { code?: string }).code !== 'auth/user-not-found') throw error;
  }
  const existingAccount = existingUid === null ? null : await db.doc(`accounts/${existingUid}`).get();
  const account = existingAccount?.exists ? (existingAccount.data() as AccountDoc) : null;
  const finalUsername = account?.username ?? username.value;

  // El nombre de usuario se comprueba antes de crear nada en Auth.
  const reserved = await db.doc(`usernames/${finalUsername}`).get();
  const owner = reserved.exists ? (reserved.data() as { uid: string }).uid : null;
  if (owner !== null && owner !== existingUid) throw new ApiError('username-taken');

  const uid = existingUid ?? (await auth.createUser({ email, password: password.value })).uid;
  const next: AccountDoc = {
    email,
    name: account?.name ?? name.value,
    username: finalUsername,
    role: 'facilitator',
    status: 'active',
  };
  await db.runTransaction(async (tx) => {
    tx.set(db.doc(`accounts/${uid}`), next);
    tx.set(db.doc(`usernames/${finalUsername}`), { uid });
  });
  return { uid, created: existingUid === null };
}

function never(): never {
  throw new Error('inalcanzable');
}

function option(args: string[], flag: string): string | undefined {
  const at = args.indexOf(flag);
  return at === -1 ? undefined : args[at + 1];
}

async function main(args: string[]): Promise<void> {
  const email = option(args, '--email');
  const name = option(args, '--name');
  const username = option(args, '--username');
  const projectId = option(args, '--project');
  const databaseId = option(args, '--database') ?? '(default)';
  const password = process.env['BOOTSTRAP_PASSWORD'];
  if (!email || !name || !username || !password) {
    console.error('Faltan datos: --email, --name, --username y la variable BOOTSTRAP_PASSWORD (--project y --database son opcionales).');
    process.exit(1);
  }
  const app = getApps()[0] ?? initializeApp(projectId ? { projectId } : {});
  const { uid, created } = await bootstrapFacilitator(
    { auth: getAuth(app), db: getFirestore(app, databaseId) },
    { email, password, name, username },
  );
  console.log(`${created ? 'Facilitador creado' : 'Cuenta promovida a facilitador'}: ${uid}`);
}

if (typeof require !== 'undefined' && require.main === module) {
  main(process.argv.slice(2)).catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  });
}
