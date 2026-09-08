import { render, screen, fireEvent } from '@testing-library/react';
import { Provider } from 'react-redux';
import { MemoryRouter } from 'react-router-dom';
import { configureStore } from '@reduxjs/toolkit';

import { MobileNav } from '..';

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

  // Consequência da mudança, e a que se veria primeiro no aparelho: em Configurações o "Mais"
  // ficava aceso, porque um dos itens dele era aquela tela. Não é mais.
  it('não fica aceso numa tela que ele não abre mais', () => {
    // Sem abrir: o painel aberto acende o "Mais" de propósito, para dizer quem está em foco.
    montar('/settings');

    expect(screen.getByText('Mais').closest('button'))
      .not.toHaveClass('mobile-nav-item--active');
  });
});
