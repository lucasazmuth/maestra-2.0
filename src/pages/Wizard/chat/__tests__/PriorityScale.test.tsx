import { act, fireEvent, render, screen } from '@testing-library/react';
import { PriorityScale } from '../PriorityScale';
import type { Strategy } from '@maestra/core/interfaces/maestra';

const strategies: Strategy[] = Array.from({length: 12}, (_, i) => ({
  id: String(i), bankId: '1', bankVersion: '4.0', type: 'WO', title: 'Estratégia ' + i, tasks: [],
}));
const objectives = ['Resultados digitais', 'Agenda de shows', 'Sustentabilidade financeira'];

it('limita a escolha a dez e entrega percentual sem pré-selecionar', () => {
  const onConfirm = jest.fn();
  render(<PriorityScale strategies={strategies} objectives={objectives} onConfirm={onConfirm} />);
  fireEvent.click(screen.getByText('Me ajuda, Nyta'));
  const boxes = screen.getAllByRole('checkbox') as HTMLInputElement[];
  expect(boxes.every(box => !box.checked)).toBe(true);
  boxes.slice(0, 10).forEach(box => fireEvent.click(box));
  expect(boxes[10].disabled).toBe(true);
  fireEvent.click(screen.getByText('Gerar plano de ação'));
  expect(onConfirm.mock.calls[0][1]).toHaveLength(10);
  expect(onConfirm.mock.calls[0][0][0].finalScore).toBe(87);
});

it('persiste as notas manuais no desmonte e retoma a próxima estratégia', () => {
  jest.useFakeTimers();
  const onProgress = jest.fn();
  const view = render(<PriorityScale strategies={strategies.slice(0,2)} objectives={objectives}
    onConfirm={jest.fn()} onProgress={onProgress} />);
  fireEvent.click(screen.getByText('Eu prefiro priorizar por conta própria'));
  fireEvent.click(screen.getByRole('button', { name: 'Nota 1' }));
  act(() => jest.advanceTimersByTime(360));
  fireEvent.click(screen.getByRole('button', { name: 'Nota 1' }));
  act(() => jest.advanceTimersByTime(360));
  fireEvent.click(screen.getByRole('button', { name: 'Nota 1' }));
  act(() => jest.advanceTimersByTime(360));
  view.unmount();
  const saved = onProgress.mock.calls[0][0];
  expect(saved[0].artistScores[0]).toBe(1);
  render(<PriorityScale strategies={saved} objectives={objectives} onConfirm={jest.fn()} />);
  expect(screen.getByText('Estratégia 2 de 2')).toBeTruthy();
  jest.useRealTimers();
});

it('não grava autosave depois da confirmação', () => {
  jest.useFakeTimers();
  const onProgress = jest.fn();
  const view = render(<PriorityScale strategies={strategies.slice(0,1)} objectives={objectives}
    onConfirm={jest.fn()} onProgress={onProgress} />);
  fireEvent.click(screen.getByText('Me ajuda, Nyta'));
  fireEvent.click(screen.getByRole('checkbox'));
  fireEvent.click(screen.getByText('Gerar plano de ação'));
  act(() => jest.runAllTimers());
  view.unmount();
  expect(onProgress).not.toHaveBeenCalled();
  jest.useRealTimers();
});
