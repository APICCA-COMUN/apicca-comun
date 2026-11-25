// RF-9 (024) · 9.2, D-T12 (024): «Entrar» vuelve a esta página.
// RF-21 (001), RF-6 (002) · 6.5, RF-3 (003) · 3.2, 3.3, RF-17 (003) · 17.1,
// RF-18 (019) · 18.1, D-T12 (019) · Vista «Archivados»: la autora ve los suyos y la facilitadora todos. Visitantes y cuentas
// suspendidas no la ven; las reglas de Firestore lo vuelven a exigir (RNF-4 (001)). El título de la página es h1.
// D-T17 (019): la lista recibe el listado de `useApiceListing`.
import { NO_FILTERS } from '../../shared/domain/discovery';
import { Link } from '../app/router';
import { useSession, type SessionState } from '../app/session';
import { useApiceListing } from '../app/useApiceListing';
import { usePageTitle } from '../app/usePageTitle';
import { SignInLink } from '../components/SignInLink';
import { ApiceList } from '../components/ApiceList';
import { firestoreListSource, type ListSource } from '../data/apices';

export function ArchivedApices({ source = firestoreListSource }: { source?: ListSource }) {
  usePageTitle({ area: 'Ápices', contentTitle: 'Archivados' });
  const session = useSession();
  if (session.status === 'loading') return <p>Cargando…</p>;
  if (session.status !== 'person') {
    return (
      <section>
        <h1>Archivados</h1>
        <p>Los ápices archivados son solo para cuentas con sesión activa.</p>
        <SignInLink />
      </section>
    );
  }
  return <Archived session={session} source={source} />;
}

function Archived({ session, source }: { session: Extract<SessionState, { status: 'person' }>; source: ListSource }) {
  const all = session.role === 'facilitator';
  const listing = useApiceListing({ audience: all ? 'archived-all' : 'archived-own', filters: NO_FILTERS, uid: session.uid, source });
  return (
    <section>
      <h1>Archivados</h1>
      <div className="lot">
        {listing.status === 'loading' ? <p>Cargando…</p> : null}
        <ApiceList
          listing={listing}
          empty={() => <p className="block block-empty">{all ? 'No hay ápices archivados.' : 'No tienes ápices archivados.'}</p>}
        />
      </div>
      <Link href="/" className="c-enlace">Volver al inicio</Link>
    </section>
  );
}
