import { render, screen, fireEvent } from '@testing-library/react';
import { Provider } from 'react-redux';
import { MemoryRouter } from 'react-router-dom';
import { configureStore } from '@reduxjs/toolkit';

import { MobileNav, isNavExcludedRoute } from '..';

// O que o "Mais" da tab bar guarda — e, sobretudo, o que ele NÃO guarda.
//
// Perfis, Configurações e Suporte já moraram aqui dentro, e por isso o botão de grade do header
// sumia abaixo de 960px. Quando eles saíram, nenhuma suíte reclamou: a composição deste painel
// não estava presa em lugar nenhum, e devolvê-los seria um commit silencioso que traz de volta a
// mistura de módulos do perfil com atalhos da conta.

jest.mock('react-i18next', () => ({
  // A tab bar chama `t(chave, { defaultValue })`; o app roda em português e é o defaultValue que
  // aparece na tela.
  useTranslation: () => [(_chave: string, opcoes?: { defaultValue?: string }) =>
    opcoes?.defaultValue ?? _chave],
}));

const madha = {
  id: 'madha',
  user_id: 'user-1',
  name: 'Madhá',
  content: { spotifyProfile: { image: 'https://i.scdn.co/image/foto-da-madha' } },
};

const montar = (rota = '/artists/madha/perfil') => {
  const store = configureStore({
    reducer: {
      artists: (state = { items: [madha], loading: false, loaded: true, currentArtistId: 'madha' }) => state,
    },
  });

  render(
    <Provider store={store}>
      <MemoryRouter initialEntries={[rota]}>
        <MobileNav />
      </MemoryRouter>
    </Provider>
  );

};

const abrirOMais = (rota?: string) => {
  montar(rota);
  fireEvent.click(screen.getByText('Mais'));
};

// O rótulo é o ÚLTIMO span da célula: o primeiro é o ícone, e um ícone SVG importado vira o nome
// do arquivo no jest (o `fileTransform` do CRA), que entraria no `textContent` da célula inteira.
const itensDoMais = () =>
  Array.from(document.querySelectorAll('.mobile-more-item'))
    .map((b) => b.querySelector('span:last-child')?.textContent?.trim());

describe('o "Mais" da tab bar', () => {
  it('guarda os módulos do perfil que não couberam na barra', () => {
    abrirOMais();

    expect(itensDoMais()).toEqual([
      'Diagnóstico REAL',
      'Plano estratégico',
      'Equipe',
      'Marketing',
    ]);
  });

  // A regra, dita pelo nome: o painel é dos MÓDULOS deste perfil. Atalhos da conta — que não
  // pertencem a perfil nenhum — moram no menu do sistema, no botão de grade do header, que
  // aparece em qualquer largura desde que estes três saíram daqui.
  it('não guarda os atalhos da conta, que moram no menu do sistema', () => {
    abrirOMais();

    for (const daConta of ['Perfis', 'Configurações', 'Suporte']) {
      expect(itensDoMais()).not.toContain(daConta);
    }
  });

  // Consequência da mudança, e a que se veria primeiro no aparelho: numa tela da conta o "Mais"
  // ficava aceso, porque um dos itens dele era aquela tela. Não é mais.
  //
  // ⚠️ A ROTA DE EXEMPLO ERA `/settings`, e mudou porque a barra deixou de aparecer LÁ: o teste
  // passou a montar um componente que não desenha nada, e falhava a dizer que não encontrava o
  // "Mais". `/notifications` é a tela global que ainda tem barra, e serve ao mesmo propósito.
  it('não fica aceso numa tela que ele não abre mais', () => {
    // Sem abrir: o painel aberto acende o "Mais" de propósito, para dizer quem está em foco.
    montar('/notifications');

    expect(screen.getByText('Mais').closest('button'))
      .not.toHaveClass('mobile-nav-item--active');
  });
});

// ONDE A TAB BAR NÃO ENTRA.
//
// A regra é UMA só, e o `Layout` lê a mesma função para reservar (ou não) os 56px do rodapé. Se
// as duas discordassem, o app guardaria espaço para uma barra que ninguém desenha, ou desenharia
// uma barra por cima do conteúdo. O comentário no componente já avisava disso; faltava o teste.
describe('onde a tab bar não entra', () => {
  // ⚠️ /planos TEM contexto de artista e mesmo assim não a quer: a página fala da CONTA, não do
  // perfil. A barra oferecia Plano, Músicas e Agenda por cima dos cartões de preço, tapando o
  // seletor de mensal e anual, e convidava a sair no meio de uma decisão.
  it.each([
    ['/planos'],
    ['/planos/sucesso'],
    ['/settings'],
    // Ainda não existe, e é de propósito: quando existir, já está decidido que é tela da conta.
    ['/settings/conta'],
    ['/artists'],
    ['/admin/usuarios'],
    ['/artists/madha/nyta'],
  ])('%s fica sem a barra', (rota) => {
    expect(isNavExcludedRoute(rota)).toBe(true);
  });

  // E o resto continua com ela: uma lista de exclusões que crescesse sozinha esvaziaria a barra.
  it.each([
    ['/artists/madha/perfil'],
    ['/artists/madha/catalogo'],
    ['/notifications'],
  ])('%s continua com a barra', (rota) => {
    expect(isNavExcludedRoute(rota)).toBe(false);
  });

  it('em /planos o componente não desenha nada', () => {
    montar('/planos');
    expect(screen.queryByText('Mais')).toBeNull();
  });
});
