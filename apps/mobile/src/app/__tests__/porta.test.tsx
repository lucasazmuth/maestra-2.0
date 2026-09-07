import { render } from '@testing-library/react-native';

import Porta from '../index';

// A PORTA DE ENTRADA: para onde o app abre.
//
// Com sessão, o app. Sem sessão, a APRESENTAÇÃO — e não o formulário de login, que era onde
// quem instalava caía sem uma linha dizendo do que se tratava.
//
// Sempre, e não uma vez por instalação: abrir o app do zero é o momento em que se pergunta "o
// que é isto", e a resposta tem que estar lá toda vez. Quem acabou de SAIR da conta não passa
// por aqui — o portão da sessão manda direto ao login.

const destinos: string[] = [];
jest.mock('expo-router', () => ({
  Redirect: ({ href }: { href: string }) => { destinos.push(href); return null; },
}));

let mockSessao: { sessao: unknown; carregando: boolean } = { sessao: null, carregando: false };
jest.mock('@/nucleo/sessao', () => ({ useSessao: () => mockSessao }));

beforeEach(() => { destinos.length = 0; });

describe('porta de entrada', () => {
  it('sem sessão, abre na apresentação', async () => {
    mockSessao = { sessao: null, carregando: false };
    await render(<Porta />);

    expect(destinos).toEqual(['/intro']);
  });

  it('com sessão, abre nos perfis', async () => {
    mockSessao = { sessao: { user: { id: 'u-1' } }, carregando: false };
    await render(<Porta />);

    expect(destinos).toEqual(['/perfis']);
  });

  // O piscar clássico: mandar para o login e voltar meio segundo depois, porque a sessão estava
  // no disco o tempo todo.
  it('enquanto não sabe, não manda ninguém a lugar nenhum', async () => {
    mockSessao = { sessao: null, carregando: true };
    await render(<Porta />);

    expect(destinos).toEqual([]);
  });
});
