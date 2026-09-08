import { render, screen, fireEvent } from '@testing-library/react';
import { Provider } from 'react-redux';
import { MemoryRouter } from 'react-router-dom';
import { configureStore } from '@reduxjs/toolkit';

// O `jest.mock` abaixo é içado para cima deste import pelo babel-jest, então os mocks valem
// mesmo o componente sendo importado aqui.
import { SystemMenu } from '..';

// O primeiro item do menu do sistema. O app nativo já guarda estas regras em
// `casca/__tests__/MenuDoSistema.test.tsx`; este arquivo é o outro lado da paridade — sem ele
// a web podia voltar a "Perfis" com ícone genérico e ninguém quebraria.

// ─── Mocks ────────────────────────────────────────────────────────────────────

// Os dois hooks de admin consultam o banco dentro de efeitos. O que se testa aqui é o item de
// perfil, e não a resolução de papel: fora do admin o menu fica com Trocar perfil,
// Configurações, Suporte e Sair, que é o menu da maioria das contas.
jest.mock('@maestra/core/hooks/useIsPlatformAdmin', () => ({
  useIsPlatformAdmin: () => false,
}));

jest.mock('@maestra/core/hooks/useAdminRole', () => ({
  useAdminRole: () => ({ ehAdminPleno: false, podeAcessar: () => false }),
}));

// A slice de auth é importada pelo componente (o "Sair da conta"), e ela puxa o supabase.
jest.mock('@maestra/core/lib/supabase', () => ({
  supabase: {
    auth: { signOut: jest.fn().mockResolvedValue({ error: null }) },
    from: () => ({
      select: () => ({
        eq: () => ({ maybeSingle: () => Promise.resolve({ data: null, error: null }) }),
      }),
    }),
  },
}));

// ─── Cenário ──────────────────────────────────────────────────────────────────

const FOTO = 'https://i.scdn.co/image/foto-da-madha';

const madha = {
  id: 'madha',
  user_id: 'user-1',
  name: 'Madhá',
  content: { spotifyProfile: { image: FOTO } },
};

const abrirOMenu = (rota: string, currentArtistId?: string) => {
  const store = configureStore({
    reducer: {
      auth: (state = { user: { id: 'user-1' } }) => state,
      artists: (state = { items: [madha], loading: false, loaded: true, currentArtistId }) => state,
    },
  });

  render(
    <Provider store={store}>
      <MemoryRouter initialEntries={[rota]}>
        <SystemMenu />
      </MemoryRouter>
    </Provider>
  );

  fireEvent.click(screen.getByLabelText('Menu do sistema'));
};

const trocarPerfil = () => screen.queryByRole('menuitem', { name: /Trocar perfil/ });

// A foto mora dentro do `span aria-hidden` do ícone, fora da árvore de acessibilidade — é
// decoração, o nome do item já está no rótulo. Por isso a busca é pelo DOM, e não por papel.
const fotoDoItem = () => trocarPerfil()!.querySelector('img');

describe('o primeiro item do menu do sistema', () => {
  // Quem está dentro de um artista não vai ali para ver uma lista: vai para SAIR deste e entrar
  // noutro.
  it('diz "Trocar perfil", e não "Perfis"', () => {
    abrirOMenu('/artists/madha/perfil');

    expect(trocarPerfil()).toBeInTheDocument();
    expect(screen.queryByRole('menuitem', { name: /^Perfis$/ })).not.toBeInTheDocument();
  });

  it('é o primeiro da grade', () => {
    abrirOMenu('/artists/madha/perfil');

    expect(screen.getAllByRole('menuitem')[0]).toHaveTextContent('Trocar perfil');
  });

  // O ícone vira a foto de quem está aberto: o menu diz de quem é a sessão sem um clique.
  it('com um perfil aberto, mostra a foto dele no lugar do ícone', () => {
    abrirOMenu('/artists/madha/perfil');

    expect(fotoDoItem()).toHaveAttribute('src', FOTO);
  });

  // Em Configurações e Notificações não há artista na URL. Sem esta queda para o último aberto
  // o item perderia a foto no meio da navegação, e voltaria a ser um ícone genérico.
  it('fora das rotas de artista, mantém a foto do último perfil aberto', () => {
    abrirOMenu('/settings', 'madha');

    expect(fotoDoItem()).toHaveAttribute('src', FOTO);
  });

  it('sem perfil nenhum no contexto, continua no ícone', () => {
    abrirOMenu('/settings');

    expect(fotoDoItem()).toBeNull();
  });

  // Na própria lista de perfis o item só fecharia o menu e deixaria a pessoa onde já estava.
  // Um item que não leva a lugar nenhum ensina a desconfiar do menu inteiro.
  it('some quando já se está na lista de perfis', () => {
    abrirOMenu('/artists');

    expect(trocarPerfil()).not.toBeInTheDocument();
    // E o resto do menu continua ali: o item sumiu, o painel não.
    expect(screen.getByRole('menuitem', { name: /Configurações/ })).toBeInTheDocument();
  });

  // O `isItemActive` trata '/artists' à parte, e parece código morto agora que o item some na
  // lista. É o contrário: sem aquele caso, o `startsWith` acenderia "Trocar perfil" em azul
  // dentro de TODO perfil aberto, porque toda página de artista é '/artists/:id/...'.
  it('não acende dentro de um perfil aberto', () => {
    abrirOMenu('/artists/madha/perfil');

    // O destaque é uma classe do módulo SCSS, que no jest chega pelo nome (identity-obj-proxy).
    expect(trocarPerfil()!.className).not.toMatch(/itemActive/);
  });
});
