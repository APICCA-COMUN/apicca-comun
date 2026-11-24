// RF-3 (001) · Formulario de correo y contraseña, común a `/entrar` y al diálogo de reautenticación.
// RF-6 (002) · 6.1, 6.3: campos, aviso y envío como bloques; «Entrar» es la acción principal.
// RF-7 (008) · 7.5, 7.7, D-10 (008): «Correo» con su ejemplo y el aviso de error después de «Entrar», sin bloque.
// RF-5 (005): «Mostrar contraseña» con `aria-pressed`, «Entrar» a todo el ancho y un ícono decorativo antes del error.
import { useState, type FormEvent } from 'react';
import { signInMessage } from '../app/authMessages';
import { authCode, useAuthService } from '../data/authService';
import './SignInForm.css';

/** Ojo angular (sin curvas ni círculos), abierto o tachado mientras la contraseña se ve. */
function EyeGlyph({ crossed }: { crossed: boolean }) {
  return (
    <svg viewBox="0 0 24 24" width={22} height={22} aria-hidden="true" focusable="false" className="sign-in-form__glyph">
      <path d="M2 12 L7 6 H17 L22 12 L17 18 H7 Z" />
      <rect x="9.5" y="9.5" width="5" height="5" />
      {crossed && <path d="M4 20 L20 4" />}
    </svg>
  );
}

/** Señal de error: cuadrado con signo de exclamación. */
function AlertGlyph() {
  return (
    <svg viewBox="0 0 24 24" width={18} height={18} aria-hidden="true" focusable="false" className="sign-in-form__glyph">
      <rect x="3" y="3" width="18" height="18" />
      <path d="M12 7 V13 M12 16.5 V17" />
    </svg>
  );
}

export function SignInForm({ autoFocus = false }: { autoFocus?: boolean }) {
  const auth = useAuthService();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [shown, setShown] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await auth.signIn(email.trim(), password);
    } catch (failure) {
      setError(signInMessage(authCode(failure)));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="sign-in-form" onSubmit={(event) => void submit(event)}>
      <label>
        Correo
        <input className="block" type="email" placeholder="tu@correo.com" autoComplete="email" required autoFocus={autoFocus} value={email} onChange={(e) => setEmail(e.target.value)} />
      </label>
      <div className="sign-in-form__password">
        <label>
          Contraseña
          <input className="block" type={shown ? 'text' : 'password'} autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
        </label>
        <button
          type="button"
          className="block icon-button sign-in-form__reveal"
          aria-label="Mostrar contraseña"
          aria-pressed={shown}
          onClick={() => setShown((value) => !value)}
        >
          <EyeGlyph crossed={shown} />
        </button>
      </div>
      <button type="submit" className="block action-primary" disabled={busy}>
        Entrar
      </button>
      {error !== null && (
        <p role="alert" className="block sign-in-form__error">
          <AlertGlyph />
          {error}
        </p>
      )}
    </form>
  );
}
