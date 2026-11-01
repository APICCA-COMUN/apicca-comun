// Componente raíz: elige la página según la ruta y deja fijos el aviso de suspensión y la reautenticación.
// La cabecera va fuera de `<main>` para que esté en toda ruta, incluida la desconocida (D-T16 (002)).
import type { ReactElement } from 'react';
import { useRoute, type PageId } from './app/router';
import { usePageTitle } from './app/usePageTitle';
import { ReauthDialog } from './components/ReauthDialog';
import { SiteFooter } from './components/SiteFooter';
import { SiteHeader } from './components/SiteHeader';
import { SuspendedNotice } from './components/SuspendedNotice';
import { ActionPage } from './pages/Action';
import { AmendmentView } from './pages/AmendmentView';
import { Amendments } from './pages/Amendments';
import { ApiceEdit } from './pages/ApiceEdit';
import { ApiceHistory } from './pages/ApiceHistory';
import { ApiceNew } from './pages/ApiceNew';
import { ArchivedApices } from './pages/ArchivedApices';
import { ConstitutionDocument } from './pages/ConstitutionDocument';
import { ConstitutionHistory } from './pages/ConstitutionHistory';
import { ConstitutionSection } from './pages/ConstitutionSection';
import { ApiceView } from './pages/ApiceView';
import { LazyBoundary, lazyPage } from './components/LazyBoundary';
import { Dashboard } from './pages/Dashboard';
import { FacilitationAccounts } from './pages/FacilitationAccounts';
import { FacilitationEnrollments } from './pages/FacilitationEnrollments';
import { FacilitationInvitations } from './pages/FacilitationInvitations';
import { ForgotPage } from './pages/Forgot';
import { Home } from './pages/Home';
import { LoginPage } from './pages/Login';
import { NotFound } from './pages/NotFound';
import { Prototyping } from './pages/Prototyping';
import { RegisterInfoPage } from './pages/RegisterInfoPage';
import { RegisterPage } from './pages/RegisterPage';
import { RequestPage } from './pages/RequestPage';

// RNF-4 (003), D-T16 (003): la documentación y la constitución cargan aparte, fuera del trozo de entrada.
const Documentation = lazyPage(() => import('./pages/Documentation'));
const ConstitutionPage = lazyPage<object>(() => import('./pages/ConstitutionPage').then((m) => ({ default: m.ConstitutionPage })));
// D-T9 (009): el foro también carga aparte.
const Forum = lazyPage<object>(() => import('./pages/Forum').then((m) => ({ default: m.Forum })));
const ForumThread = lazyPage<object>(() => import('./pages/ForumThread').then((m) => ({ default: m.ForumThread })));

/** Página de cada ruta; la de inicio y la no encontrada se resuelven aparte. Cada tarea agrega la suya aquí. */
const PAGES: Partial<Record<PageId, (params: Record<string, string>) => ReactElement>> = {
  home: () => <Home />,
  // RF-18 (003), RF-11 (003): el mapa y la lista viven en Prototipado; Mi tablero junta lo propio.
  prototyping: () => <Prototyping />,
  dashboard: () => <Dashboard />,
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
  apiceNew: () => <ApiceNew />,
  apiceEdit: (params) => <ApiceEdit id={params['id'] ?? ''} />,
  apiceView: (params) => <ApiceView id={params['id'] ?? ''} />,
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
  usePageTitle({});
  const route = useRoute();
  const page = PAGES[route.page];
  return (
    <>
      <SiteHeader />
      <main>
        <SuspendedNotice />
        <ReauthDialog />
        {page ? (
          page(route.params)
        ) : (
          <NotFound />
        )}
      </main>
      <SiteFooter />
    </>
  );
}
