// Fecha de un hecho. Se guarda como día `YYYY-MM-DD` sin hora y se compara como cadena.
// Colombia es UTC−5 sin horario de verano, así que "hoy" se calcula restando cinco horas al instante
// UTC, igual que haría una regla de Firestore; sin `Intl`, para que el navegador y
// el servidor den el mismo día.

const COLOMBIA_OFFSET_MS = 5 * 3600 * 1000;
const EVENT_DATE_FORM = /^(\d{4})-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;

function pad(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

/** El día de hoy en Colombia para un instante dado, como `YYYY-MM-DD`. */
export function todayInColombia(now: Date): string {
  const shifted = new Date(now.getTime() - COLOMBIA_OFFSET_MS);
  return `${shifted.getUTCFullYear()}-${pad(shifted.getUTCMonth() + 1)}-${pad(shifted.getUTCDate())}`;
}

export type EventDateResult = { ok: true } | { ok: false; reason: string };

/** Verdadero si el día existe en el calendario (rechaza 30 de febrero, 29 de febrero fuera de bisiesto…). */
function existsInCalendar(year: number, month: number, day: number): boolean {
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

/**
 * Exige forma `YYYY-MM-DD`, un día que exista y que no sea posterior a hoy en
 * Colombia. El motivo continúa la frase «La fecha del hecho …», así que no
 * repite el sujeto: quien lo muestra le pone delante el nombre del campo.
 */
export function validateEventDate(eventDate: string, now: Date): EventDateResult {
  const match = EVENT_DATE_FORM.exec(eventDate);
  if (!match) {
    return { ok: false, reason: 'debe tener la forma AAAA-MM-DD' };
  }
  const [, y, m, d] = match;
  if (!existsInCalendar(Number(y), Number(m), Number(d))) {
    return { ok: false, reason: 'no existe en el calendario' };
  }
  if (eventDate > todayInColombia(now)) {
    return { ok: false, reason: 'no puede ser futura: solo se registra lo ya ocurrido' };
  }
  return { ok: true };
}
