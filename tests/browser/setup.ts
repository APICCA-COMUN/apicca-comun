// RF-21 (021), D-T42 (021): en las pruebas que montan el sitio en la página, la invitación a jugar se da por vista, para que
// no tape las medidas ni las capturas del mapa. La captura `bienvenida` la abre con `?bienvenida=1`.
import { beforeEach } from 'vitest';

beforeEach(() => {
  try {
    localStorage.setItem('apicca:bienvenida', '1');
  } catch {
    // Sin almacenamiento, la invitación aparece y las pruebas lo dirán.
  }
});
