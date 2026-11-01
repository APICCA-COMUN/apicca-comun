// RF-6 (001), RF-5 (001), RF-9 (001), RNF-10 (001), RF-12 (003) · 12.1, 12.5, RF-3 (003) · 3.2 · Página para proponer un ápice: pide los datos mínimos, el servidor lo
// crea privado y en «idea», y la persona pasa a su ficha. Quien no tiene sesión activa es enviado a entrar.
import { messageFor } from '../../shared/domain/messages';
import { ContentForm, EMPTY_VALUES } from '../components/ContentForm';
import { useDrafts } from '../app/drafts';
import { Link, navigate } from '../app/router';
import { useSession } from '../app/session';
import { usePageTitle } from '../app/usePageTitle';
import { api, type ApiOps, type OpClient } from '../data/api';

const DRAFT_KEY = 'apice:new';

export function ApiceNew({ client = api }: { client?: OpClient<ApiOps> }) {
  usePageTitle({ area: 'Ápices', contentTitle: 'Nuevo ápice' });
  const session = useSession();
  const drafts = useDrafts();

  if (session.status === 'loading') return <p>Cargando…</p>;
  if (session.status === 'suspended') {
    return (
      <section>
        <h1>Proponer un ápice</h1>
        <p>{messageFor('account-suspended')}</p>
      </section>
    );
  }
  if (session.status === 'visitor') {
    return (
      <section>
        <h1>Proponer un ápice</h1>
        <p>Para proponer un ápice necesitas entrar con tu cuenta.</p>
        <Link href="/entrar">Entrar</Link>
      </section>
    );
  }
  return (
    <section className="lot">
      <h1>Proponer un ápice</h1>
      <p>Tu ápice nace privado y en estado «idea».</p>
      <ContentForm
        initial={EMPTY_VALUES}
        draftKey={DRAFT_KEY}
        submitLabel="Crear ápice"
        location={{ stored: null }}
        onSubmit={async ({ name, description, axes, needs, offers }, location) => {
          // Un ápice nuevo solo puede nacer con una ubicación puesta; «conservar» es no mandar nada.
          const place = location?.mode === 'set' ? { location } : {};
          const { id } = await client.call('createApice', { name, description, axes, needs, offers, ...place });
          drafts.clear(DRAFT_KEY);
          navigate(`/apices/${id}`);
        }}
      />
    </section>
  );
}
