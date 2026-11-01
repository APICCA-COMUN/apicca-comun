// RF-12 (004) · 12.5, D-T7 (004) · Reflejar el vencimiento antes de mostrar: la cuenta activa llama a `settleAmendments`
// (con `id` opcional para una sola propuesta) y después relee. Quien no tiene cuenta activa no lo llama: no ve las
// propuestas (RF-9 (004) · 9.4) y la op le diría que no.
import { api } from '../api';

/** Cómo se llama a la op; en las pruebas es un doble. */
export type SettleCall = (payload: { id?: string }) => Promise<unknown>;

const callApi: SettleCall = (payload) => api.call('settleAmendments', payload);

export interface SettleThenReadInput<T> {
  /** Solo una cuenta activa llama a la op. */
  active: boolean;
  /** Limita el cierre a una propuesta; sin él, el servidor procesa las vencidas (a lo sumo 10 por llamada). */
  id?: string;
  /** La lectura que se hace después de llamar; recibe el resultado de aplicar el vencimiento. */
  read: () => Promise<T> | T;
  settle?: SettleCall;
}

/**
 * Llama antes de leer. Si la llamada falla (sin red, por ejemplo), la lectura se hace igual y `settled` queda en
 * `false`: la persona ve lo último que hay en lugar de una pantalla vacía.
 */
export async function settleThenRead<T>({ active, id, read, settle = callApi }: SettleThenReadInput<T>): Promise<{ settled: boolean; value: T }> {
  let settled = false;
  if (active) {
    try {
      await settle(id === undefined ? {} : { id });
      settled = true;
    } catch {
      settled = false;
    }
  }
  return { settled, value: await read() };
}
