// RF-4 (021) · 4.5, RNF-10 (001), RF-6 (002) · 6.1, D-T18 (021) · Límite del mapa: si el mapa falla al dibujarse, en su lugar
// van un aviso y lo que la página dé de respaldo (la lista); lo que está al lado sigue en pie.
import { Component } from 'react';
import type { ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
  /** Lo que se muestra debajo del aviso si el mapa falla: la vista de lista. */
  fallback?: ReactNode;
}

interface State {
  failed: boolean;
}

export class MapBoundary extends Component<Props, State> {
  override state: State = { failed: false };

  static getDerivedStateFromError(): State {
    return { failed: true };
  }

  override componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('El mapa falló', error, info.componentStack);
  }

  override render(): ReactNode {
    if (!this.state.failed) return this.props.children;
    return (
      <>
        <p role="alert" className="block">El mapa no cargó. La lista sigue disponible.</p>
        {this.props.fallback}
      </>
    );
  }
}
