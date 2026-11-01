// RF-14 (003) · 14.7, D-T10 (003), RF-7 (017), D-1 (017) · Ruta desconocida: dice que no encontró la página, con título propio
// y un enlace a la portada. `App` y `Documentation` (artículo inexistente) muestran lo mismo.
import { Link } from '../app/router';
import { usePageTitle } from '../app/usePageTitle';

export const NOT_FOUND_TITLE = 'No encontramos esta página';

export function NotFound() {
  usePageTitle({ contentTitle: NOT_FOUND_TITLE });
  return (
    <>
      <h1>{NOT_FOUND_TITLE}</h1>
      <p>Puede que el enlace esté mal escrito o que la página ya no exista.</p>
      <p>
        <Link href="/">Volver al inicio</Link>
      </p>
    </>
  );
}
