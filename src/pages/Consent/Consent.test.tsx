import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

import Consent from './index';

// A tela real busca o estado (needsBirthDate, pendingDocs) da edge function via useConsent, e
// despacha o signOut da store — nenhum dos dois deve rodar de verdade num teste. `needsBirthDate`
// mockado como true é o que faz o campo de data aparecer: é exatamente o caso "conta antiga, sem
// data registrada" que motivou este redesenho (ver useConsent.tsx e account-consent/index.ts).
jest.mock('../../hooks/useConsent', () => ({
  useConsent: () => ({
    state: { needsBirthDate: true, pendingDocs: [], blocked: false, reviewStatus: 'ok' },
    apply: jest.fn(),
  }),
}));

jest.mock('../../store/store', () => ({
  useAppDispatch: () => jest.fn(),
}));

jest.mock('../../store/slices/auth', () => ({
  authActions: { signOut: jest.fn(() => ({ type: 'auth/signOut' })) },
}));

const renderTela = () =>
  render(
    <MemoryRouter>
      <Consent />
    </MemoryRouter>
  );

describe('Consent — campo de data de nascimento segmentado', () => {
  it('avanca o foco automaticamente ao completar dia e mes', () => {
    renderTela();
    const dia = screen.getByLabelText('Dia');
    const mes = screen.getByLabelText('Mês');
    const ano = screen.getByLabelText('Ano');

    fireEvent.change(dia, { target: { value: '23' } });
    expect(mes).toHaveFocus();

    fireEvent.change(mes, { target: { value: '02' } });
    expect(ano).toHaveFocus();
  });

  it('filtra caracteres nao numericos e respeita o tamanho de cada campo', () => {
    renderTela();
    const dia = screen.getByLabelText('Dia');
    const ano = screen.getByLabelText('Ano');

    fireEvent.change(dia, { target: { value: '2a3b' } });
    expect(dia).toHaveValue('23');

    fireEvent.change(ano, { target: { value: '19951' } });
    expect(ano).toHaveValue('1995');
  });

  it('backspace num campo vazio volta o foco pro campo anterior', () => {
    renderTela();
    const dia = screen.getByLabelText('Dia');
    const mes = screen.getByLabelText('Mês');

    fireEvent.change(dia, { target: { value: '23' } });
    mes.focus();
    fireEvent.keyDown(mes, { key: 'Backspace' });
    expect(dia).toHaveFocus();
  });

  it('colar uma data completa no campo do dia distribui os digitos pelos tres campos', () => {
    renderTela();
    const dia = screen.getByLabelText('Dia');
    const ano = screen.getByLabelText('Ano');

    fireEvent.paste(dia, {
      clipboardData: { getData: () => '23/02/1995' },
    });

    expect(dia).toHaveValue('23');
    expect(screen.getByLabelText('Mês')).toHaveValue('02');
    expect(ano).toHaveValue('1995');
    expect(ano).toHaveFocus();
  });

  it('acusa data que nao existe no calendario so depois dos tres campos completos', () => {
    renderTela();
    fireEvent.change(screen.getByLabelText('Dia'), { target: { value: '31' } });
    fireEvent.change(screen.getByLabelText('Mês'), { target: { value: '02' } });
    expect(screen.queryByText('Essa data não existe no calendário.')).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Ano'), { target: { value: '1995' } });
    expect(screen.getByText('Essa data não existe no calendário.')).toBeInTheDocument();
  });

  it('acusa menor de idade e deixa o botao desabilitado ate marcar os aceites', async () => {
    renderTela();
    fireEvent.change(screen.getByLabelText('Dia'), { target: { value: '10' } });
    fireEvent.change(screen.getByLabelText('Mês'), { target: { value: '05' } });
    fireEvent.change(screen.getByLabelText('Ano'), { target: { value: String(new Date().getFullYear() - 10) } });

    expect(await screen.findByText(/conta ficará bloqueada para revisão/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Confirmar e continuar/ })).toBeDisabled();
  });
});
