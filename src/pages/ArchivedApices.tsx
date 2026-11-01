// RF-21 (001), RF-6 (002) · 6.5, RF-3 (003) · 3.2, 3.3, RF-17 (003) · 17.1 · Vista «Archivados»: la autora ve los suyos y la facilitadora todos. Visitantes y cuentas
// suspendidas no la ven; las reglas de Firestore lo vuelven a exigir (RNF-4 (001)).
import { NO_FILTERS } from '../../shared/domain/discovery';
import { Link } from '../app/router';
import { useSession } from '../app/session';
import { usePageTitle } from '../app/usePageTitle';
import { ApiceList } from '../components/ApiceList';
import { firestoreListSource, type ListSource } from '../data/apices';

export function ArchivedApices({ source = firestoreListSource }: { source?: ListSource }) {
  usePageTitle({ area: 'Ápices', contentTitle: 'Archivados' });
  const session = useSession();
  if (session.status === 'loading') return <p>Cargando…</p>;
  if (session.status !== 'person') {
    return (
      <section>
        <h2>Archivados</h2>
        <p>Los ápices archivados son solo para cuentas con sesión activa.</p>
        <Link href="/entrar">Entrar</Link>
      </section>
    );
  }
  const all = session.role === 'facilitator';
  return (
    <section>
      <h2>Archivados</h2>
      <div className="lot">
        <ApiceList
          audience={all ? 'archived-all' : 'archived-own'}
          filters={NO_FILTERS}
          uid={session.uid}
          source={source}
          empty={() => <p className="block block-empty">{all ? 'No hay ápices archivados.' : 'No tienes ápices archivados.'}</p>}
        />
      </div>
      <Link href="/">Volver al inicio</Link>
    </section>
  );
}
