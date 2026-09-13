import fs from 'fs';
import path from 'path';

import { render, screen, fireEvent } from '@testing-library/react';
import { Provider } from 'react-redux';
import { MemoryRouter } from 'react-router-dom';
import { configureStore } from '@reduxjs/toolkit';

import { MobileNav, temTabBar } from '..';

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
  // ⚠️ A ROTA DE EXEMPLO JÁ MUDOU DUAS VEZES, e a segunda explica a inversão da regra: era
  // `/settings`, passou a `/notifications`, e as duas deixaram de ter barra. Nenhuma tela da
  // conta serve mais de exemplo — o "Mais" só existe dentro de um perfil. A pergunta continua a
  // valer ali dentro: numa tela do perfil que ele NÃO abre, ele não pode ficar aceso.
  it('não fica aceso numa tela que ele não abre mais', () => {
    // Sem abrir: o painel aberto acende o "Mais" de propósito, para dizer quem está em foco.
    montar('/artists/madha/agenda');

    expect(screen.getByText('Mais').closest('button'))
      .not.toHaveClass('mobile-nav-item--active');
  });
});

// ONDE A TAB BAR ENTRA, E ONDE NÃO.
//
// ⚠️ A REGRA ERA UMA LISTA DE EXCEÇÕES E ESTAVA DO AVESSO. Dizia "aparece sempre que houver um
// artista atual no store, MENOS em…", e a lista cresceu uma tela de cada vez: a lista de perfis,
// o admin, os planos, as configurações. Cada tela global nova nascia com uma barra que não lhe
// servia, e só se descobria olhando para o telemóvel.
//
// Invertida, ela diz o que a barra É: navega entre os módulos de UM PERFIL, então só existe onde
// há um perfil na ROTA. As telas da conta ficam de fora sem precisar de ser lembradas, e a
// próxima nasce certa.
//
// O `Layout` lê a MESMA função para reservar (ou não) os 56px do rodapé. Se as duas
// discordassem, o app guardaria espaço para uma barra que ninguém desenha.
describe('onde a tab bar entra', () => {
  it.each([
    ['/artists/madha'],
    ['/artists/madha/perfil'],
    ['/artists/madha/catalog'],
    ['/artists/madha/catalog/projects/p-1'],
    ['/artists/madha/agenda'],
    ['/artists/madha/action-plan'],
  ])('%s tem barra: é módulo de um perfil', (rota) => {
    expect(temTabBar(rota)).toBe(true);
  });

  // As telas da CONTA. Nenhuma delas precisou de entrar numa lista: elas não têm perfil na rota.
  // As três últimas nunca chegaram a ser pedidas — saíram de graça com a inversão.
  it.each([
    ['/planos'],
    ['/planos/sucesso'],
    ['/settings'],
    ['/settings/conta'],
    ['/notifications'],
    ['/suporte'],
    ['/pagamentos'],
    ['/pagamento'],
    ['/artists'],
    ['/admin/usuarios'],
  ])('%s não tem barra: fala da conta, não do perfil', (rota) => {
    expect(temTabBar(rota)).toBe(false);
  });

  // O chat da Nyta fica de fora por outro motivo, que é dele: é uma conversa que se lê e se
  // escreve, e as duas barras roubavam a altura do que importa ali.
  it('o chat da Nyta não tem barra, mesmo tendo perfil na rota', () => {
    expect(temTabBar('/artists/madha/nyta')).toBe(false);
  });

  it.each([['/planos'], ['/settings'], ['/notifications']])(
    'em %s o componente não desenha nada',
    (rota) => {
      montar(rota);
      expect(screen.queryByText('Mais')).toBeNull();
    },
  );

  // ⚠️ E O LAYOUT LÊ A MESMA FUNÇÃO, que é o que o comentário do componente promete e nada
  // garantia. Ele reserva 56px no rodapé para a barra; se calculasse por conta própria, bastava
  // uma das duas regras mudar para o app guardar espaço para uma barra que ninguém desenha — ou
  // desenhar uma barra por cima do conteúdo. Isto lê o ficheiro porque a discordância não falha
  // teste de render nenhum: aparece só no telemóvel, como um vão no fim da página.
  it('o Layout reserva o rodapé pela MESMA regra', () => {
    const layout = fs.readFileSync(
      path.join(__dirname, '..', '..', '..', 'index.tsx'), 'utf8',
    );

    expect(layout).toMatch(/import\s*\{[^}]*temTabBar[^}]*\}\s*from\s*'\.\/components\/MobileNav'/);
    expect(layout).toMatch(/const\s+hasMobileNav\s*=\s*temTabBar\(/);
  });
});
