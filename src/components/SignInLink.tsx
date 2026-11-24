// RF-9 (024) · 9.2, D-T12 (024): enlace «Entrar» que, al hacer clic, guarda la página de origen para volver a ella tras entrar
// (RF-3 (004) · 3.4). Se guarda al hacer clic y no al montar la página: quien se va a otra parte y entra más tarde por la
// cabecera no es devuelto a un lugar que ya no recuerda.
import type { ReactNode } from 'react';
import { saveReturnTo } from '../app/returnTo';
import { Link } from '../app/router';

interface Props {
  /** Texto del enlace; «Entrar» por defecto. */
  children?: ReactNode;
  /** Ruta de origen; por defecto, la de la página en el momento del clic. Una ruta no interna se descarta. */
  from?: string;
}

export function SignInLink({ children = 'Entrar', from }: Props) {
  return (
    <Link href="/entrar" onClick={() => saveReturnTo(from ?? window.location.pathname)}>
      {children}
    </Link>
  );
}
