// RNF-10 (001) · Límite de error raíz: si algo falla al pintar la app entera (por ejemplo, una dirección que no se puede
// leer), en vez de una página en blanco se muestra un aviso con un enlace al inicio. Va en `main.tsx`, por fuera de todo.
// Es un enlace común (`<a href="/">`), no `navigate`: recarga el sitio y deja atrás cualquier estado roto.
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
      <div className="lot">
        <p role="alert" className="block">Algo salió mal y no pudimos mostrar esta página.</p>
        <a href="/" className="block action-secondary">
          Volver al inicio
        </a>
      </div>
    );
  }
}
