// Componente raíz: elige la página según la ruta y deja fijos el aviso de suspensión y la reautenticación.
// En las páginas de texto la cabecera y el pie van fuera de `<main>`, también en la ruta desconocida (D-T16 (002)).
// RF-11 (021), RF-16 (021) · 16.1, RF-17 (021) · 17.1–17.3, D-T21 (021): `/` y los paneles del ápice pintan el mapa (`Play`),
// sin cabecera ni pie de sitio, y siempre el mismo elemento, para que el mapa no se vuelva a montar al abrir un panel.
// `/prototipado` y `/tablero` llevan al mapa sin quedar en el historial.
import { useEffect, type ReactElement } from 'react';
import { isMapPage, navigate, useRoute, type PageId } from './app/router';
import { useSession } from './app/session';
import { ReauthDialog } from './components/ReauthDialog';
import { SiteFooter } from './components/SiteFooter';
import { SiteHeader } from './components/SiteHeader';
import { SuspendedNotice } from './components/SuspendedNotice';
import { ActionPage } from './pages/Action';
import { AmendmentView } from './pages/AmendmentView';
import { Amendments } from './pages/Amendments';
import { ApiceHistory } from './pages/ApiceHistory';
import { ArchivedApices } from './pages/ArchivedApices';
import { ConstitutionDocument } from './pages/ConstitutionDocument';
import { ConstitutionHistory } from './pages/ConstitutionHistory';
import { ConstitutionSection } from './pages/ConstitutionSection';
import { LazyBoundary, lazyPage } from './components/LazyBoundary';
import { FacilitationAccounts } from './pages/FacilitationAccounts';
import { FacilitationEnrollments } from './pages/FacilitationEnrollments';
import { FacilitationInvitations } from './pages/FacilitationInvitations';
import { ForgotPage } from './pages/Forgot';
import { LoginPage } from './pages/Login';
import { NotFound } from './pages/NotFound';
import { Play } from './pages/Play';
import { RegisterInfoPage } from './pages/RegisterInfoPage';
import { RegisterPage } from './pages/RegisterPage';
import { RequestPage } from './pages/RequestPage';

// RNF-4 (003), D-T16 (003): la documentación y la constitución cargan aparte, fuera del trozo de entrada.
const Documentation = lazyPage(() => import('./pages/Documentation'));
const ConstitutionPage = lazyPage<object>(() => import('./pages/ConstitutionPage').then((m) => ({ default: m.ConstitutionPage })));
// D-T9 (009): el foro también carga aparte.
const Forum = lazyPage<object>(() => import('./pages/Forum').then((m) => ({ default: m.Forum })));
const ForumThread = lazyPage<object>(() => import('./pages/ForumThread').then((m) => ({ default: m.ForumThread })));

/** `/prototipado` lleva al mapa con la misma consulta (RF-17 (021) · 17.1). */
function PrototypingRedirect() {
  useEffect(() => navigate(`/${window.location.search}`, { replace: true }), []);
  return null;
}

/** `/tablero` lleva a «Lo mío» con sesión, a entrar sin ella y al mapa con la cuenta suspendida (RF-17 (021) · 17.2, 17.3). */
function DashboardRedirect() {
  const session = useSession();
  useEffect(() => {
    if (session.status === 'person') navigate('/?mio=1', { replace: true });
    else if (session.status === 'visitor') navigate('/entrar?volver=%2Ftablero', { replace: true });
    else if (session.status === 'suspended') navigate('/', { replace: true });
  }, [session.status]);
  return session.status === 'loading' ? <p>Cargando…</p> : null;
}

/** Página de cada ruta de texto; las del mapa y la no encontrada se resuelven aparte. Cada tarea agrega la suya aquí. */
const PAGES: Partial<Record<PageId, (params: Record<string, string>) => ReactElement>> = {
  prototyping: () => <PrototypingRedirect />,
  dashboard: () => <DashboardRedirect />,
  archived: () => <ArchivedApices />,
  login: () => <LoginPage />,
  forgot: () => <ForgotPage />,
  action: () => <ActionPage />,
  register: (params) => <RegisterPage token={params['token'] ?? ''} />,
  registerInfo: () => <RegisterInfoPage />,
  request: () => <RequestPage />,
  facilitationInvitations: () => <FacilitationInvitations />,
  facilitationEnrollments: () => <FacilitationEnrollments />,
  facilitationAccounts: () => <FacilitationAccounts />,
  apiceHistory: (params) => <ApiceHistory id={params['id'] ?? ''} />,
  // Constitución común (004): historiales, documentos y propuestas (T-10.21 (004), D-T13 (004)).
  constitutionHistory: () => <ConstitutionHistory />,
  constitutionSection: (params) => <ConstitutionSection id={params['id'] ?? ''} />,
  constitutionDocument: (params) => <ConstitutionDocument id={params['id'] ?? ''} />,
  amendments: () => <Amendments />,
  forum: () => (
    <LazyBoundary>
      <Forum />
    </LazyBoundary>
  ),
  forumThread: () => (
    <LazyBoundary>
      <ForumThread />
    </LazyBoundary>
  ),
  amendmentDetail: (params) => <AmendmentView id={params['id'] ?? ''} />,
  // RF-14 (003), RF-15 (003).
  documentation: (params) => (
    <LazyBoundary>
      <Documentation slug={params['articulo']} />
    </LazyBoundary>
  ),
  constitution: () => (
    <LazyBoundary>
      <ConstitutionPage />
    </LazyBoundary>
  ),
};

export function App() {
  const route = useRoute();
  const map = isMapPage(route.page);
  const page = PAGES[route.page];
  return (
    <>
      {!map && <SiteHeader />}
      <main className={map ? 'main--play' : undefined}>
        <SuspendedNotice />
        <ReauthDialog />
        {map ? <Play /> : page ? page(route.params) : <NotFound />}
      </main>
      {!map && <SiteFooter />}
    </>
  );
}
