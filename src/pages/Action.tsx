// RF-3 (001), RF-2 (001) · Página `/accion`: fija la contraseña nueva con el código del enlace de Auth.
// RF-13 (003) · 13.1, 13.2, D-T19 (003): formulario en un lote angosto; «Pedir otro enlace» y «Entrar» son enlaces de texto.
// RF-6 (002) · 6.1, 6.3: campo, avisos y envío como bloques; «Cambiar contraseña» es la acción principal.
import { useEffect, useState, type FormEvent } from 'react';
import { validatePassword } from '../../shared/domain/accounts';
import { messageFor } from '../../shared/domain/messages';
import { isResetLinkError, RESET_LINK_INVALID, SIGN_IN_FAILED } from '../app/authMessages';
import { Link } from '../app/router';
import { authCode, useAuthService } from '../data/authService';

type Phase = 'checking' | 'form' | 'invalid' | 'done';

export function ActionPage() {
  const auth = useAuthService();
  const params = new URLSearchParams(window.location.search);
  const code = params.get('mode') === 'resetPassword' ? (params.get('oobCode') ?? '') : '';
  const [phase, setPhase] = useState<Phase>(code === '' ? 'invalid' : 'checking');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (code === '') return;
    let current = true;
    auth.verifyResetCode(code).then(
      (address) => {
        if (!current) return;
        setEmail(address);
        setPhase('form');
      },
      () => current && setPhase('invalid'),
    );
    return () => {
      current = false;
    };
  }, [auth, code]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    const checked = validatePassword(password);
    if (!checked.ok) {
      setError(messageFor(checked.code));
      return;
    }
    setError(null);
    try {
      await auth.confirmReset(code, password);
      setPhase('done');
    } catch (failure) {
      if (isResetLinkError(authCode(failure))) setPhase('invalid');
      else setError(SIGN_IN_FAILED);
    }
  }

  return (
    <div className="lot lot--access">
      <h1>Elegir contraseña nueva</h1>
      {phase === 'checking' && <p role="status" className="block">Comprobando el enlace…</p>}
      {phase === 'invalid' && (
        <>
          <p role="alert" className="block">{RESET_LINK_INVALID}</p>
          <p>
            <Link href="/olvide">Pedir otro enlace</Link>
          </p>
        </>
      )}
      {phase === 'form' && (
        <form onSubmit={(event) => void submit(event)}>
          <p>Cuenta: {email}</p>
          <label>
            Contraseña nueva
            <input className="block" type="password" autoComplete="new-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
          </label>
          {error !== null && <p role="alert" className="block">{error}</p>}
          <button type="submit" className="block action-primary">Cambiar contraseña</button>
        </form>
      )}
      {phase === 'done' && (
        <>
          <p role="status" className="block">Tu contraseña cambió.</p>
          <p>
            <Link href="/entrar">Entrar</Link>
          </p>
        </>
      )}
    </div>
  );
}
