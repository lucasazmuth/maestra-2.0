import { render, waitFor } from '@testing-library/react-native';

import { PortaoDoConsentimento } from '@/nucleo/PortaoDoConsentimento';

// O PORTÃO DO CONSENTIMENTO (LGPD).
//
// Quem entra por Google ou Apple nunca declarou idade nem aceitou os documentos: o provedor
// devolve uma sessão e pronto. Sem este portão essa pessoa usaria o app inteiro sem nada
// registrado — e é o registro que sustenta a regra de maioridade dos Termos e da Política.

const mockReplace = jest.fn();
let mockSegmentos: string[] = ['perfis'];
jest.mock('expo-router', () => ({
  // O portão importa o `router` do módulo, e não o `useRouter()`: ver o comentário dele.
  router: { replace: (...a: unknown[]) => mockReplace(...a) },
  useSegments: () => mockSegmentos,
}));

// ⚠️ O PORTÃO LÊ O `useConsent`, e não consulta por conta própria.
//
// Consultava, e a tela de coleta consultava outra vez: duas verdades sobre a mesma pessoa. Ver
// "um estado só" em `umEstadoDoConsentimento.test.tsx`, que é onde essa regra mora.
let mockEstado: { satisfied: boolean } | null = null;
jest.mock('@maestra/core/hooks/useConsent', () => ({
  useConsent: () => ({ state: mockEstado }),
}));

beforeEach(() => {
  mockReplace.mockClear();
  mockSegmentos = ['perfis'];
  mockEstado = null;
});

describe('portão do consentimento', () => {
  it('quem não consentiu vai para a tela de consentimento', async () => {
    mockEstado = { satisfied: false };
    await render(<PortaoDoConsentimento />);

    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('/consentimento'));
  });

  it('quem já consentiu segue a vida', async () => {
    mockEstado = { satisfied: true };
    await render(<PortaoDoConsentimento />);

    expect(mockReplace).not.toHaveBeenCalled();
  });

  // Trancar todo mundo do lado de fora por uma falha transitória é pior do que o risco que o
  // portão cobre, e a coleta volta a ser exigida na próxima verificação que der certo. É a
  // mesma decisão que o `RequireConsent` da web tomou.
  it('estado indisponível não tranca ninguém', async () => {
    mockEstado = null;
    await render(<PortaoDoConsentimento />);

    expect(mockReplace).not.toHaveBeenCalled();
  });

  // Sem sessão o provedor não consulta nada e o estado vem nulo — é o mesmo caminho do de cima,
  // e o portão não tem como distinguir os dois. Não há o que cobrar a quem não entrou.

  // Empurrar quem já está na tela para a mesma tela é um laço.
  it('não expulsa quem já está no consentimento', async () => {
    mockEstado = { satisfied: false };
    mockSegmentos = ['consentimento'];
    await render(<PortaoDoConsentimento />);

    expect(mockReplace).not.toHaveBeenCalled();
  });

  // ⚠️ O PORTÃO NÃO PODE TRANCAR O QUE ELE PEDE PARA ACEITAR.
  //
  // A tela do consentimento liga para os Termos e para a Política, e tem um botão de falar com o
  // suporte para quem errou a data de nascimento. Enquanto esses três destinos abriam o
  // navegador, o portão nem os via. No dia em que viraram telas do app, sem a lista de livres ele
  // devolvia a pessoa ao consentimento no instante em que ela tocasse em "Termos de uso" — pedir
  // o aceite de um documento e trancar a porta do documento.
  it.each([['legal'], ['suporte']])('deixa ler o que pede para aceitar: /%s', async (segmento) => {
    mockEstado = { satisfied: false };
    mockSegmentos = [segmento];
    await render(<PortaoDoConsentimento />);

    expect(mockReplace).not.toHaveBeenCalled();
  });

  // ⚠️ E NAS TELAS PÚBLICAS ELE NÃO AGE, QUE É A CORREÇÃO DO APP TRAVADO.
  //
  // Quem está em `entrar`, `intro` ou `cadastro` ainda não entrou: quem manda ali é o
  // `PortaoDaSessao`, que leva a `/perfis` assim que a sessão nasce. Sem esta regra os dois
  // portões agarravam o volante no mesmo instante — um a levar para os perfis, o outro para o
  // aceite — e cada um desfazia o do outro.
  //
  // Foi assim que o login pela Apple travou o app, e não por acaso: quem entra por provedor
  // social é exatamente quem ainda não declarou idade nem aceitou os documentos. Uma sonda
  // mostrou-o em números: 52 pedidos de `replace('/consentimento')` vindos do segmento
  // `entrar`. O que se via era a tela desenhada com todos os toques a serem engolidos — e a
  // conta ficava SEM consentimento registado, que é a coisa que este portão existe para
  // garantir.
  //
  // Agora são dois movimentos EM SEQUÊNCIA: a sessão leva de `entrar` a `perfis`, e só então o
  // consentimento leva de `perfis` ao aceite.
  it.each([['entrar'], ['intro'], ['cadastro']])(
    'não disputa a rota com o portão da sessão em /%s',
    async (segmento) => {
      mockEstado = { satisfied: false };
      mockSegmentos = [segmento];
      await render(<PortaoDoConsentimento />);

      expect(mockReplace).not.toHaveBeenCalled();
    },
  );

  // E o resto continua trancado: uma lista de livres que crescesse sozinha esvaziaria o portão.
  it('o resto do app continua trancado', async () => {
    mockEstado = { satisfied: false };
    mockSegmentos = ['artista'];
    await render(<PortaoDoConsentimento />);

    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('/consentimento'));
  });
});
