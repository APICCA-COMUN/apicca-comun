// RF-17 (001), RF-18 (001), RF-19 (001), RF-20 (001), RNF-2 (001), RF-6 (002); RF-4 (003) · 4.8, 4.11 · Panel de la imagen pixelada de un ápice: generar
// (con las generaciones que quedan hoy, la hora de reinicio y el bloqueo), ver la propuesta propia y aceptarla con su
// texto alternativo o descartarla. Si la generación no está disponible, el resto de la ficha sigue igual.
// Controles y avisos son bloques; «Generar» y «Descartar» son secundarias; «Aceptar propuesta» es la única azul sin advertencias; «Aceptar de todos modos» es destructiva; sin propuesta no hay azul (RF-4 (003) · 4.8, 4.11).
// RF-7 (002) · 7.1, 7.2: la propuesta se ve en un edificio con los ejes del ápice. La condición «propuesta pendiente» (RF-13 (002)) no tiene texto visible en la 001 aquí.
import { useCallback, useEffect, useState } from 'react';
import { validateAltText } from '../../shared/domain/images';
import { messageFor } from '../../shared/domain/messages';
import { compareTimestamps } from '../../shared/domain/order';
import { api, ApiClientError, media, type ApiOps, type MediaOps, type OpClient, type ProposalWarning } from '../data/api';
import { firestoreProposalSource, type ProposalRow, type ProposalSource } from '../data/proposals';
import type { Axis } from '../../shared/domain/apice';
import { Building } from './Building';

interface Props {
  apiceId: string;
  uid: string;
  /** Persona inscrita activa y ápice no archivado. */
  canGenerate: boolean;
  /** Ejes del ápice: los íconos del edificio de la propuesta. */
  axes?: readonly Axis[];
  source?: ProposalSource;
  client?: OpClient<ApiOps>;
  mediaClient?: OpClient<MediaOps>;
  now?: () => number;
}

type Status = ApiOps['generationStatus']['out'];

const FALLBACK = 'No se pudo completar la acción. Inténtalo de nuevo.';
const errorText = (caught: unknown): string => (caught instanceof ApiClientError ? caught.message : FALLBACK);

const WARNING_TEXT: Record<ProposalWarning, string> = {
  'content-changed': 'Desde que se generó esta propuesta cambió el contenido del ápice.',
  'image-changed': 'Desde que se generó esta propuesta cambió la imagen del ápice.',
  'reference-removed': 'La propuesta usó una referencia que ya se quitó.',
};

/** Hora en Colombia (el reinicio es a medianoche allá), sin depender de la zona del navegador. */
const colombiaTime = (iso: string): string =>
  new Intl.DateTimeFormat('es-CO', { hour: 'numeric', minute: '2-digit', timeZone: 'America/Bogota' }).format(new Date(iso));

export function ProposalPanel({
  apiceId,
  uid,
  canGenerate,
  axes = [],
  source = firestoreProposalSource,
  client = api,
  mediaClient = media,
  now = Date.now,
}: Props) {
  const [status, setStatus] = useState<Status | 'unavailable' | null>(null);
  const [proposal, setProposal] = useState<ProposalRow | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [altText, setAltText] = useState('');
  const [altError, setAltError] = useState<string | null>(null);
  const [warnings, setWarnings] = useState<ProposalWarning[] | null>(null);

  const refreshStatus = useCallback(async () => {
    try {
      setStatus(await client.call('generationStatus', {}));
    } catch {
      setStatus('unavailable');
    }
  }, [client]);

  useEffect(() => {
    if (canGenerate) void refreshStatus();
  }, [canGenerate, refreshStatus]);

  useEffect(
    () =>
      source.onProposal(apiceId, uid, (row) => {
        setProposal(row);
        if (row === null) {
          setWarnings(null);
          setAltText('');
        }
      }),
    [source, apiceId, uid],
  );

  const generate = async () => {
    setError(null);
    setBusy(true);
    try {
      await mediaClient.call('generateImage', { id: apiceId });
    } catch (caught) {
      setError(errorText(caught));
    } finally {
      setBusy(false);
      await refreshStatus();
    }
  };

  const accept = async (confirm: boolean) => {
    setError(null);
    const checked = validateAltText(altText);
    if (!checked.ok) {
      setAltError(messageFor(checked.code));
      return;
    }
    setAltError(null);
    setBusy(true);
    try {
      const result = await client.call('acceptProposal', confirm ? { id: apiceId, altText: checked.value, confirm } : { id: apiceId, altText: checked.value });
      setWarnings(result.ok ? null : result.warnings);
    } catch (caught) {
      setError(errorText(caught));
    } finally {
      setBusy(false);
    }
  };

  const discard = async () => {
    setError(null);
    setBusy(true);
    try {
      await client.call('discardProposal', { id: apiceId });
    } catch (caught) {
      setError(errorText(caught));
    } finally {
      setBusy(false);
    }
  };

  const expired =
    proposal?.expiresAt !== undefined && compareTimestamps(proposal.expiresAt, { seconds: Math.floor(now() / 1000), nanoseconds: 0 }) <= 0;

  const blocked = typeof status === 'object' && status !== null && status.blockedUntil !== null && Date.parse(status.blockedUntil) > now();
  const exhausted = typeof status === 'object' && status !== null && status.remaining <= 0;
  const canPress = typeof status === 'object' && status !== null && !blocked && !exhausted && !busy;

  return (
    <section aria-label="Imagen pixelada">
      <h3>Imagen pixelada</h3>
      {proposal !== null && canGenerate ? (
        <div>
          <Building image={{ altText: 'Propuesta de imagen', png: proposal.png }} axes={axes} max={2} />
          {expired ? (
            <p>La propuesta caducó. Descártala y genera otra.</p>
          ) : (
            <div>
              <label>
                Texto alternativo
                <input className="block" value={altText} onChange={(e) => setAltText(e.target.value)} />
              </label>
              {altError !== null ? <p role="alert" className="block">{altError}</p> : null}
              {warnings !== null ? (
                <div role="alert" className="block">
                  <ul>
                    {warnings.map((w) => (
                      <li key={w}>{WARNING_TEXT[w]}</li>
                    ))}
                  </ul>
                  <button type="button" className="block action-destructive" disabled={busy} onClick={() => void accept(true)}>
                    Aceptar de todos modos
                  </button>
                </div>
              ) : (
                <button type="button" className="block action-primary" disabled={busy} onClick={() => void accept(false)}>
                  Aceptar propuesta
                </button>
              )}
            </div>
          )}
          <button type="button" className="block action-secondary" disabled={busy} onClick={() => void discard()}>
            Descartar propuesta
          </button>
        </div>
      ) : null}
      {canGenerate ? (
        <div>
          {status === 'unavailable' ? <p>La generación no está disponible por ahora.</p> : null}
          {typeof status === 'object' && status !== null ? (
            blocked && status.blockedUntil !== null ? (
              <p>Generar está en pausa hasta las {colombiaTime(status.blockedUntil)} (hora de Colombia).</p>
            ) : exhausted ? (
              <p>
                Ya usaste tus {status.limit} generaciones de hoy. Vuelven a las {colombiaTime(status.resetAt)} (hora de Colombia).
              </p>
            ) : (
              <p>
                Te quedan {status.remaining} de {status.limit} generaciones hoy. Se reinician a las {colombiaTime(status.resetAt)} (hora de Colombia).
              </p>
            )
          ) : null}
          {error !== null ? <p role="alert" className="block">{error}</p> : null}
          <button type="button" className="block action-secondary" disabled={!canPress} onClick={() => void generate()}>
            Generar imagen
          </button>
        </div>
      ) : null}
    </section>
  );
}
