import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Provider } from 'react-redux';
import { MemoryRouter } from 'react-router-dom';
import { configureStore } from '@reduxjs/toolkit';

// O thunk real chama o Supabase; aqui interessa QUAL provedor ele recebe.
const mockSignInWithOAuth = jest.fn();
jest.mock('../../../lib/supabase', () => ({
  supabase: {
    auth: {
      signInWithOAuth: (...args: any[]) => mockSignInWithOAuth(...args),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe: jest.fn() } } }),
    },
  },
}));

// eslint-disable-next-line import/first
import { AuthShell } from '../AuthShell';

const renderizar = () =>
  render(
    <Provider store={configureStore({ reducer: { auth: (s = {}) => s } })}>
      <MemoryRouter>
        <AuthShell>
          <div>formulário</div>
        </AuthShell>
      </MemoryRouter>
    </Provider>
  );

beforeEach(() => {
  mockSignInWithOAuth.mockReset();
  mockSignInWithOAuth.mockResolvedValue({ data: {}, error: null });
});

describe('AuthShell - login social', () => {
  // A diretriz 4.8 da App Store exige o Sign in with Apple quando ja existe outro login social.
  // Sem ele o app nao entra na loja, entao a ausencia do botao precisa quebrar a suite.
  it('oferece Apple ao lado do Google', () => {
    renderizar();

    expect(screen.getByRole('button', { name: /google/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /apple/i })).toBeInTheDocument();
  });

  // O risco real de uma tela com dois botoes iguais e um chamar o provedor do outro — falha
  // silenciosa, porque a tela redireciona e parece funcionar.
  it.each([
    ['google', /google/i],
    ['apple', /apple/i],
  ])('o botão %s dispara exatamente esse provedor', async (provider, rotulo) => {
    renderizar();

    await userEvent.click(screen.getByRole('button', { name: rotulo }));

    await waitFor(() => expect(mockSignInWithOAuth).toHaveBeenCalledTimes(1));
    expect(mockSignInWithOAuth).toHaveBeenCalledWith(expect.objectContaining({ provider }));
  });

  // O aviso de erro dizia "Google" na mao. Com dois provedores, a pessoa que tentou entrar pela
  // Apple leria que o Google falhou.
  it('nomeia o provedor certo quando ele está desabilitado', async () => {
    mockSignInWithOAuth.mockResolvedValue({
      data: null,
      error: new Error('Unsupported provider: provider is not enabled'),
    });
    renderizar();

    await userEvent.click(screen.getByRole('button', { name: /apple/i }));

    expect(await screen.findByText(/Login com Apple indisponível/i)).toBeInTheDocument();
    expect(screen.queryByText(/Google indisponível/i)).not.toBeInTheDocument();
  });
});
