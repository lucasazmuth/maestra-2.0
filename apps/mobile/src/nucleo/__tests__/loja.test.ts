import { Linking } from 'react-native';

import { irParaOCheckout } from '../loja';

// O repasse para o checkout: o que a pessoa vê é o navegador abrindo já logado. O que pode dar
// errado é a function falhar — e aí o botão não pode virar um botão morto.
//
// ⚠️ SÓ O DESBLOQUEIO AINDA SAI. A assinatura deixou de sair do app na submissão à App Store —
// `MODO_DE_VENDA` é `'nenhuma'`, e as telas que a vendiam levam agora à tela `/planos`, que
// mostra e não vende. Por isso os casos do repasse passaram todos a usar o desbloqueio, que é o
// pagamento único e continua a ser cobrado dentro do app por decisão do produto.

const mockInvocar = jest.fn();
jest.mock('@maestra/core/lib/supabase', () => ({
  supabase: { functions: { invoke: (...a: unknown[]) => mockInvocar(...a) } },
}));

describe('ir para o checkout', () => {
  let abrir: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    abrir = jest.spyOn(Linking, 'openURL').mockResolvedValue(true as never);
  });

  it('abre o link autenticado que a function devolve', async () => {
    mockInvocar.mockResolvedValue({ data: { url: 'https://link.magico/abc', autenticado: true } });

    await irParaOCheckout({ destino: 'desbloqueio', artistId: 'a-1' });

    expect(mockInvocar).toHaveBeenCalledWith('checkout-handoff', {
      body: { destino: 'desbloqueio', artistId: 'a-1' },
    });
    expect(abrir).toHaveBeenCalledWith('https://link.magico/abc');
  });

  // ⚠️ A CHAVE DESLIGA A VENDA DA ASSINATURA, e este é o caso que o prova.
  //
  // Ela era uma promessa escrita no comentário do `loja.ts`: nenhuma linha de código a lia antes
  // de abrir o navegador. Quem contasse com ela para desligar a venda depois de uma recusa da
  // revisão descobriria no ciclo seguinte, com o app já submetido.
  //
  // Nem sequer pergunta à function: um repasse que ninguém vai usar é uma ida ao servidor e um
  // link mágico gasto por nada.
  it('não sai do app para assinar, com a chave em "nenhuma"', async () => {
    await irParaOCheckout({ destino: 'assinatura' });

    expect(abrir).not.toHaveBeenCalled();
    expect(mockInvocar).not.toHaveBeenCalled();
  });

  it('manda o perfil quando o destino é o desbloqueio', async () => {
    mockInvocar.mockResolvedValue({ data: { url: 'https://link.magico/xyz' } });

    await irParaOCheckout({ destino: 'desbloqueio', artistId: 'a-1' });

    expect(mockInvocar.mock.calls[0][1]).toEqual({
      body: { destino: 'desbloqueio', artistId: 'a-1' },
    });
  });

  // Sem esta rede, uma falha do repasse deixaria o botão sem reação nenhuma — e "não acontece
  // nada" é pior para quem quer pagar do que ter que digitar a senha.
  it('a function falhando, abre o endereço mesmo assim', async () => {
    mockInvocar.mockRejectedValue(new Error('sem rede'));

    await irParaOCheckout({ destino: 'desbloqueio', artistId: 'a-1' });

    expect(abrir).toHaveBeenCalledWith('https://www.maestramanager.com/artists/a-1/desbloquear');
  });

  // Um link que não seja https não abre: a resposta da function é dado externo.
  it('ignora url que não seja https', async () => {
    mockInvocar.mockResolvedValue({ data: { url: 'javascript:alert(1)' } });

    await irParaOCheckout({ destino: 'desbloqueio', artistId: 'a-1' });

    expect(abrir).toHaveBeenCalledWith('https://www.maestramanager.com/artists/a-1/desbloquear');
  });
});
