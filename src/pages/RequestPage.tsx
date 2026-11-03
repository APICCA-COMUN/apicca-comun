// RF-4 (001), RF-2 (002), RF-6 (002), RF-13 (003) · 13.1, D-T19 (003), RF-3 (020) · /solicitar: solicitud pública de inscripción. La confirmación es siempre la misma (RF-4 (001))
// y, si el envío falla, se conserva lo escrito.
import { useState, type FormEvent } from 'react';
import { LIMITS, countCodePoints } from '../../shared/domain';
import { PRIVACY_TEXT_VERSION } from '../../shared/domain/enrollment';
import { messageFor } from '../../shared/domain/messages';
import { usePageTitle } from '../app/usePageTitle';
import { api, ApiClientError, type ApiOps } from '../data/api';
import './RequestPage.css';

export interface RequestOps {
  submit(input: ApiOps['requestEnrollment']['in']): Promise<ApiOps['requestEnrollment']['out']>;
}

export const realRequestOps: RequestOps = { submit: (input) => api.call('requestEnrollment', input) };

/** Separador de miles con punto, sin depender de la configuración regional del navegador. */
const thousands = (n: number): string => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, '.');

export function RequestPage({ ops = realRequestOps }: { ops?: RequestOps }) {
  usePageTitle({ contentTitle: 'Solicitar inscripción' });
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [message, setMessage] = useState('');
  const [accepted, setAccepted] = useState(false);
  const [website, setWebsite] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent): Promise<void> {
    event.preventDefault();
    if (!accepted) {
      setError(messageFor('consent-required'));
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await ops.submit({ email, name, message, accepted, website });
      setSent(true);
    } catch (e: unknown) {
      setError(e instanceof ApiClientError ? e.message : 'No pudimos enviar tu solicitud. Inténtalo de nuevo.');
    } finally {
      setBusy(false);
    }
  }

  if (sent) {
    return (
      <div className="lot lot--access">
        <h1>Solicitar inscripción</h1>
        <p role="status" className="block">Recibimos tu solicitud. Si corresponde, un facilitador se pondrá en contacto contigo por correo.</p>
      </div>
    );
  }
  return (
    <div className="lot lot--access">
      <h1>Solicitar inscripción</h1>
      <form onSubmit={(e) => void submit(e)}>
        <label>
          Correo
          <input className="block" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        </label>
        <label>
          Nombre
          <input className="block" type="text" autoComplete="name" required value={name} onChange={(e) => setName(e.target.value)} />
        </label>
        <label>
          Mensaje
          <textarea className="block" value={message} onChange={(e) => setMessage(e.target.value)} />
        </label>
        <p>
          {thousands(countCodePoints(message))} / {thousands(LIMITS.enrollmentMessage)}
        </p>
        {/* Campo trampa: una persona no lo ve ni lo llena (D-T16 (001)). */}
        <div aria-hidden="true" className="honeypot">
          <input className="block" type="text" name="website" tabIndex={-1} autoComplete="off" value={website} onChange={(e) => setWebsite(e.target.value)} />
        </div>
        <label>
          <input className="choice" type="checkbox" checked={accepted} onChange={(e) => setAccepted(e.target.checked)} />
          Acepto que APICCA trate mis datos (correo, nombre y mensaje) para responder esta solicitud. Versión del texto: {PRIVACY_TEXT_VERSION}.
        </label>
        {error !== null && <p role="alert" className="block">{error}</p>}
        <button type="submit" className="block action-primary" disabled={busy}>
          Enviar solicitud
        </button>
      </form>
    </div>
  );
}
