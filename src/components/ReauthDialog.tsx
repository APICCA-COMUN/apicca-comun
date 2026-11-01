// RF-3 (001), RNF-10 (001) · Diálogo de reautenticación: si la sesión termina con algo escrito, pide entrar
// de nuevo encima del editor, que sigue montado, y conserva el texto en memoria.
// RF-6 (002) · 6.1, 6.3: el diálogo es un bloque; «Descartar y salir» es secundaria porque la 001 no la confirma.
import { useEffect, useRef, useState } from 'react';
import { useDrafts } from '../app/drafts';
import { useSession } from '../app/session';
import { SignInForm } from './SignInForm';

export function ReauthDialog() {
  const session = useSession();
  const drafts = useDrafts();
  /** Quien tenía la sesión antes de que terminara. */
  const lastUid = useRef<string | null>(null);
  const [previousUid, setPreviousUid] = useState<string | null>(null);

  useEffect(() => {
    if (session.status === 'person') {
      // Otra persona entró: el texto de la anterior no se le entrega.
      if (previousUid !== null && previousUid !== session.uid) drafts.clearAll();
      setPreviousUid(null);
      lastUid.current = session.uid;
    } else if (session.status === 'visitor') {
      if (lastUid.current !== null && drafts.hasAny()) setPreviousUid(lastUid.current);
      lastUid.current = null;
    } else if (session.status === 'suspended') {
      setPreviousUid(null);
    }
  }, [session, drafts, previousUid]);

  if (previousUid === null || session.status === 'person') return null;
  return (
    <div role="dialog" aria-modal="true" aria-labelledby="reauth-title" className="block">
      <h2 id="reauth-title">Tu sesión terminó</h2>
      <p>Entra de nuevo para seguir: lo que escribiste se conserva mientras esta página siga abierta.</p>
      <SignInForm autoFocus />
      <button
        type="button"
        className="block action-secondary"
        onClick={() => {
          drafts.clearAll();
          setPreviousUid(null);
        }}
      >
        Descartar y salir
      </button>
    </div>
  );
}
