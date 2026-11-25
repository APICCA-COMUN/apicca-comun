// RNF-10 (001) · Límite de error raíz: si algo falla al pintar la app entera (por ejemplo, una dirección que no se puede
// leer), en vez de una página en blanco se muestra un aviso con un enlace al inicio. Va en `main.tsx`, por fuera de todo.
// Es un enlace común (`<a href="/">`), no `navigate`: recarga el sitio y deja atrás cualquier estado roto.
// Usa `<main>` (y no un `div` con `role="main"`) para heredar de `src/styles/lots.css` el ancho, el margen lateral de 16 a 48 px
// y el aire del lote, sin duplicar esas reglas. Sigue habiendo un solo `<main>` en la página: este aviso solo se pinta cuando
// `App` ya no está montada. Es la única excepción a RF-3 (020) · 3.1 y está anotada en `tests/tooling/un-solo-main.test.ts`.
import { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  failed: boolean;
}

export class RootBoundary extends Component<Props, State> {
  override state: State = { failed: false };

  static getDerivedStateFromError(): State {
    return { failed: true };
  }

  override componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('La aplicación falló', error, info.componentStack);
  }

  override render(): ReactNode {
    if (!this.state.failed) return this.props.children;
    return (
      <main>
        <div className="lot">
          {/* Propuesta del asistente: el título «Algo salió mal» y el párrafo «No pudimos mostrar esta página.»
              reorganizan el texto anterior («Algo salió mal y no pudimos mostrar esta página.»); aún sin aprobar. */}
          <h1>Algo salió mal</h1>
          <p role="alert" className="block">No pudimos mostrar esta página.</p>
          <a href="/" className="block action-secondary">
            Volver al inicio
          </a>
        </div>
      </main>
    );
  }
}
