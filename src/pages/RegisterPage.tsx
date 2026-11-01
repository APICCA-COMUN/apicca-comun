// RF-2 (001) · /registro/:token: crea el acceso con el correo de la invitación (D-T15 (001)).
// RF-13 (003) · 13.1, 13.2, D-T19 (003): formulario en un lote angosto; «Entrar» es un enlace de texto.
// RF-6 (002) · 6.1, 6.3: campos, avisos y envío como bloques; «Crear mi acceso» es la acción principal.
// Ante cualquier error del servidor conserva lo escrito mientras la página siga abierta.
// RF-6 (017): inicia sesión con el servicio de autenticación de `src/data/`, como Entrar.
import { useEffect, useState, type FormEvent } from 'react';
import { messageFor } from '../../shared/domain/messages';
import { isSignedIn, useSession } from '../app/session';
import { Link, navigate } from '../app/router';
import { usePageTitle } from '../app/usePageTitle';
import { SignedInNotice } from '../components/SignedInNotice';
import { api, ApiClientError, type ApiOps } from '../data/api';
import { useAuthService } from '../data/authService';

export interface RegisterOps {
  inspect(token: string): Promise<ApiOps['inspectInvitation']['out']>;
  register(input: ApiOps['register']['in']): Promise<ApiOps['register']['out']>;
}

export const realRegisterOps: RegisterOps = {
  inspect: (token) => api.call('inspectInvitation', { token }),
  register: (input) => api.call('register', input),
};

const NEW_INVITATION = 'Pide una invitación nueva a un facilitador.';

/** Mensaje de un error; los de invitación indican qué hacer (RF-2 (001)), y los inesperados no filtran su detalle. */
function describe(error: unknown): string {
  if (error instanceof ApiClientError) {
    return error.code.startsWith('invitation-') ? `${error.message} ${NEW_INVITATION}` : error.message;
  }
  return 'No pudimos completar el registro. Revisa tu conexión e inténtalo de nuevo.';
}

type Inspection =
  | { kind: 'loading' }
  | { kind: 'ready'; email: string }
  | { kind: 'account-exists' }
  | { kind: 'rejected'; message: string };

export function RegisterPage({ token, ops = realRegisterOps }: { token: string; ops?: RegisterOps }) {
  usePageTitle({ contentTitle: 'Crear acceso' });
  const session = useSession();
  const auth = useAuthService();
  const [inspection, setInspection] = useState<Inspection>({ kind: 'loading' });
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let current = true;
    ops
      .inspect(token)
      .then((view) => {
        if (!current) return;
        if (view.state === 'expired') setInspection({ kind: 'rejected', message: `${messageFor('invitation-expired')} ${NEW_INVITATION}` });
        else if (view.state === 'accepted') setInspection({ kind: 'rejected', message: `${messageFor('invitation-used')} ${NEW_INVITATION}` });
        else if (view.accountExists) setInspection({ kind: 'account-exists' });
        else setInspection({ kind: 'ready', email: view.email });
      })
      .catch((e: unknown) => {
        if (current) setInspection({ kind: 'rejected', message: describe(e) });
      });
    return () => {
      current = false;
    };
  }, [token, ops]);

  async function submit(event: FormEvent): Promise<void> {
    event.preventDefault();
    if (inspection.kind !== 'ready') return;
    setBusy(true);
    setError(null);
    try {
      await ops.register({ token, password, name, username });
      await auth.signIn(inspection.email, password);
      navigate('/');
    } catch (e: unknown) {
      setError(describe(e));
    } finally {
      setBusy(false);
    }
  }

  if (isSignedIn(session)) {
    return (
      <main>
        <div className="lot lot--access">
          <h1>Crear acceso</h1>
          <SignedInNotice />
        </div>
      </main>
    );
  }
  return (
    <main>
      <div className="lot lot--access">
        <h1>Crear acceso</h1>
        {inspection.kind === 'loading' && <p role="status" className="block">Comprobando tu invitación…</p>}
        {inspection.kind === 'rejected' && <p role="alert" className="block">{inspection.message}</p>}
        {inspection.kind === 'account-exists' && (
          <p>
            Este correo ya tiene una cuenta. <Link href="/entrar">Entrar</Link>
          </p>
        )}
        {inspection.kind === 'ready' && (
          <form onSubmit={(e) => void submit(e)}>
            <label>
              Correo
              <input className="block" type="email" value={inspection.email} readOnly />
            </label>
            <label>
              Contraseña
              <input className="block" type="password" autoComplete="new-password" minLength={8} required value={password} onChange={(e) => setPassword(e.target.value)} />
            </label>
            <label>
              Nombre
              <input className="block" type="text" autoComplete="name" required value={name} onChange={(e) => setName(e.target.value)} />
            </label>
            <label>
              Nombre de usuario
              <input className="block" type="text" autoComplete="username" required value={username} onChange={(e) => setUsername(e.target.value)} />
            </label>
            {error !== null && <p role="alert" className="block">{error}</p>}
            <button type="submit" className="block action-primary" disabled={busy}>
              Crear mi acceso
            </button>
          </form>
        )}
      </div>
    </main>
  );
}
