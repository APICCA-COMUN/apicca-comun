// RNF-4 (003); D-T16 (003): carga diferida de páginas. `lazyPage` crea la página perezosa y `LazyBoundary`
// suma «Cargando…» (Suspense) y un límite de error con «Reintentar». Un `lazy` rechazado queda en caché,
// por eso reintentar rehace cada `lazy` y vuelve a llamar al `import`.
import { Component, lazy, type ComponentProps, Suspense, type ComponentType, type ErrorInfo, type ReactNode } from 'react';

/** Reinicia los `lazy` de las páginas creadas con `lazyPage`. */
const resetters = new Set<() => void>();

/** Fábrica de páginas diferidas: `lazyPage(() => import('../pages/Documentation'))`. */
export function lazyPage<P extends object>(
  loader: () => Promise<{ default: ComponentType<P> }>,
): ComponentType<P> {
  let Inner = lazy(loader);
  resetters.add(() => {
    Inner = lazy(loader);
  });
  // `Inner` se lee al pintar, así que tras un reinicio se usa el `lazy` nuevo.
  return function LazyPage(props: P) {
    return <Inner {...(props as ComponentProps<typeof Inner>)} />;
  };
}

interface Props {
  children: ReactNode;
}

interface State {
  failed: boolean;
  attempt: number;
}

export class LazyBoundary extends Component<Props, State> {
  state: State = { failed: false, attempt: 0 };

  static getDerivedStateFromError(): Partial<State> {
    return { failed: true };
  }

  componentDidCatch(_error: Error, _info: ErrorInfo): void {
    // La persona ve el aviso; no hay nada más que registrar aquí.
  }

  private retry = (): void => {
    resetters.forEach((reset) => reset());
    this.setState((s) => ({ failed: false, attempt: s.attempt + 1 }));
  };

  render() {
    if (this.state.failed) {
      return (
        <div role="alert" className="block">
          <p>No se pudo cargar esta página.</p>
          <button type="button" className="block action-secondary" onClick={this.retry}>
            Reintentar
          </button>
        </div>
      );
    }
    return (
      <Suspense fallback={<p>Cargando…</p>} key={this.state.attempt}>
        {this.props.children}
      </Suspense>
    );
  }
}
