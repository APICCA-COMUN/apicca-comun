import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import type { EnrollmentRow } from '../data/facilitation';
import { AsFacilitator, at, fakeClient, fakeSource } from '../testing/facilitationDoubles';
import { FacilitationEnrollments } from './FacilitationEnrollments';
import { blockProblems } from '../testing/expectBlocks';

const row = (id: string, extra: Partial<EnrollmentRow> = {}): EnrollmentRow => ({
  id,
  email: `${id}@ejemplo.org`,
  name: `Nombre ${id}`,
  message: `Mensaje de ${id}`,
  status: 'pending',
  createdAt: at('2026-09-01T10:00:00Z'),
  ...extra,
});

function setup(rows: EnrollmentRow[], handlers: Parameters<typeof fakeClient>[0] = {}) {
  const doubles = fakeSource({ enrollments: rows });
  const { client, calls } = fakeClient(handlers);
  render(
    <AsFacilitator>
      <FacilitationEnrollments source={doubles.source} client={client} />
    </AsFacilitator>,
  );
  return { ...doubles, calls };
}

const names = (heading: string) =>
  within(screen.getByRole('region', { name: heading }))
    .queryAllByRole('listitem')
    .map((li) => li.querySelector('strong')?.textContent);

describe('FacilitationEnrollments', () => {
  it('RF-4 (001): separa pendientes y resueltas, cada lista de la más reciente a la más antigua', () => {
    setup([
      row('a', { createdAt: at('2026-09-01T00:00:00Z') }),
      row('b', { createdAt: at('2026-09-03T00:00:00Z') }),
      row('c', { createdAt: at('2026-08-01T00:00:00Z'), status: 'accepted' }),
      row('d', { createdAt: at('2026-08-20T00:00:00Z'), status: 'discarded', reason: 'No es del barrio' }),
    ]);
    expect(names('Pendientes')).toEqual(['Nombre b', 'Nombre a']);
    expect(names('Resueltas')).toEqual(['Nombre d', 'Nombre c']);
    const resolved = screen.getByRole('region', { name: 'Resueltas' });
    expect(within(resolved).getByText('Aceptada')).toBeTruthy();
    expect(within(resolved).getByText(/No es del barrio/)).toBeTruthy();
  });

  it('RF-8 (016) · 8.3: la lista oculta las pendientes caducadas aunque el TTL aún no las haya borrado', () => {
    setup([
      row('vigente', { expiresAt: at('2999-01-01T00:00:00Z') }),
      row('caducada', { expiresAt: at('2020-01-01T00:00:00Z') }),
      row('antigua'),
    ]);
    expect(names('Pendientes').sort()).toEqual(['Nombre antigua', 'Nombre vigente']);
  });

  it('RF-4 (001): aceptar crea la invitación y muestra su enlace completo', async () => {
    const user = userEvent.setup();
    const { calls } = setup([row('a')], { resolveEnrollment: () => ({ link: '/registro/xyz' }) });
    await user.click(screen.getByRole('button', { name: 'Aceptar' }));
    expect(calls).toEqual([{ op: 'resolveEnrollment', payload: { id: 'a', decision: 'accept' } }]);
    expect((await screen.findByRole('status')).textContent).toContain(`${window.location.origin}/registro/xyz`);
  });

  it('RF-4 (001): aceptar con un correo que ya tiene cuenta lo explica', async () => {
    const user = userEvent.setup();
    setup([row('a')], { resolveEnrollment: () => ({ accountExists: true }) });
    await user.click(screen.getByRole('button', { name: 'Aceptar' }));
    expect((await screen.findByRole('status')).textContent).toContain('Ese correo ya tiene una cuenta.');
    expect(screen.queryByText(/\/registro\//)).toBeNull();
  });

  it('RF-4 (001): descartar sin motivo se rechaza sin llamar al servidor', async () => {
    const user = userEvent.setup();
    const { calls } = setup([row('a')], { resolveEnrollment: () => ({}) });
    await user.click(screen.getByRole('button', { name: 'Descartar' }));
    await user.click(screen.getByRole('button', { name: 'Confirmar descarte' }));
    expect((await screen.findByRole('alert')).textContent).toBe('Escribe el motivo del descarte.');
    expect(calls).toEqual([]);
  });

  it('RF-4 (001): descartar con motivo lo envía', async () => {
    const user = userEvent.setup();
    const { calls } = setup([row('a')], { resolveEnrollment: () => ({}) });
    await user.click(screen.getByRole('button', { name: 'Descartar' }));
    await user.type(screen.getByLabelText('Motivo'), '  Correo repetido ');
    await user.click(screen.getByRole('button', { name: 'Confirmar descarte' }));
    expect(calls).toEqual([{ op: 'resolveEnrollment', payload: { id: 'a', decision: 'discard', reason: '  Correo repetido ' } }]);
  });

  it('RF-4 (001): las resueltas no ofrecen botones de resolver', () => {
    setup([row('c', { status: 'accepted' })]);
    expect(screen.queryByRole('button', { name: 'Aceptar' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Descartar' })).toBeNull();
  });
});

describe('FacilitationEnrollments · bloques (002)', () => {
  const kinds = (el: Element) => ['action-primary', 'action-secondary', 'action-destructive'].filter((c) => el.classList.contains(c));
  const isBlock = (el: Element) => el.classList.contains('block');

  it('RF-4 (003) · 4.6: «Aceptar» es secundaria; «Descartar» y «Confirmar descarte», que exige motivo (RF-4 (001)), son destructivas', async () => {
    const user = userEvent.setup();
    setup([row('a'), row('c', { status: 'accepted' })]);
    expect(isBlock(screen.getByText('Nombre a').closest('li')!)).toBe(true);
    for (const [name, kind] of [['Aceptar', 'action-secondary'], ['Descartar', 'action-destructive']] as const) {
      const button = screen.getByRole('button', { name });
      expect(isBlock(button)).toBe(true);
      expect(kinds(button)).toEqual([kind]);
    }
    await user.click(screen.getByRole('button', { name: 'Descartar' }));
    expect(isBlock(screen.getByLabelText('Motivo'))).toBe(true);
    const confirm = screen.getByRole('button', { name: 'Confirmar descarte' });
    expect(isBlock(confirm)).toBe(true);
    expect(kinds(confirm)).toEqual(['action-destructive']);
    await user.click(confirm);
    expect(isBlock(await screen.findByRole('alert'))).toBe(true);
    expect(blockProblems(document.body)).toEqual([]);
  });

  it('RF-6 (002) · 6.1, 6.5: los estados vacíos y los avisos de estado son bloques', async () => {
    const user = userEvent.setup();
    setup([row('a')], { resolveEnrollment: () => ({ link: '/registro/xyz' }) });
    expect(screen.getByText('Aún no hay solicitudes resueltas.').className).toBe('block block-empty');
    await user.click(screen.getByRole('button', { name: 'Aceptar' }));
    expect(isBlock(await screen.findByRole('status'))).toBe(true);
    document.body.innerHTML = '';
    setup([]);
    expect(screen.getByText('No hay solicitudes pendientes.').className).toBe('block block-empty');
  });

  it('RF-3 (003) · 3.2, 3.3, RF-17 (003) · 17.1: las listas se presentan dentro de un lote y sus filas siguen siendo bloques', () => {
    setup([row('a')]);
    const lots = document.querySelectorAll('.lot');
    expect(lots.length).toBeGreaterThanOrEqual(1);
    for (const lot of lots) expect(lot.classList.contains('block')).toBe(false);
    const item = screen.getByText('Nombre a').closest('li')!;
    expect(item.classList.contains('block')).toBe(true);
    expect(Array.from(lots).some((lot) => lot.contains(item))).toBe(true);
  });
});
