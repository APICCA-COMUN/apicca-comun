// RF-3 (001), RF-2 (017) · Página `/olvide`: pide el correo y responde siempre lo mismo, exista o no, esté activa o suspendida.
// RF-13 (003) · 13.1, 13.2, D-T19 (003): formulario en un lote angosto; «Volver a entrar» es un enlace de texto.
// RF-6 (002) · 6.1, 6.3: campo, avisos y envío como bloques; «Enviar enlace» es la acción principal.
import { useState, type FormEvent } from 'react';
import { RESET_SENT } from '../app/authMessages';
import { Link } from '../app/router';
import { usePageTitle } from '../app/usePageTitle';
import { authCode, useAuthService } from '../data/authService';

export function ForgotPage() {
  const auth = useAuthService();
  usePageTitle({ contentTitle: 'Restablecer contraseña' });
  const [email, setEmail] = useState('');
  const [done, setDone] = useState(false);
  const [offline, setOffline] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setOffline(false);
    try {
      await auth.sendReset(email.trim());
      setDone(true);
    } catch (failure) {
      // Solo la falta de red se dice: cualquier otro error diría algo del correo.
      if (authCode(failure) === 'auth/network-request-failed') setOffline(true);
      else setDone(true);
    }
  }

  return (
    <div className="lot lot--access">
      <h1>Restablecer contraseña</h1>
      <form onSubmit={(event) => void submit(event)}>
        <label>
          Correo electrónico
          <input className="block" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        </label>
        {offline && <p role="alert" className="block">No hay conexión. Inténtalo de nuevo.</p>}
        <button type="submit" className="block action-primary">Enviar enlace</button>
      </form>
      {done && <p role="status" className="block">{RESET_SENT}</p>}
      <p>
        <Link href="/entrar">Volver a entrar</Link>
      </p>
    </div>
  );
}
