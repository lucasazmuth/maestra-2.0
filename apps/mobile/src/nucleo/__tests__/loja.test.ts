import { Linking } from 'react-native';

import { irParaOCheckout } from '../loja';

// O repasse para o checkout: o que a pessoa vê é o navegador abrindo já logado. O que pode dar
// errado é a function falhar — e aí o botão não pode virar um botão morto.

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

    await irParaOCheckout({ destino: 'assinatura' });

    expect(mockInvocar).toHaveBeenCalledWith('checkout-handoff', {
      body: { destino: 'assinatura' },
    });
    expect(abrir).toHaveBeenCalledWith('https://link.magico/abc');
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

    await irParaOCheckout({ destino: 'assinatura' });

    expect(abrir).toHaveBeenCalledWith('https://www.maestramanager.com/assinatura');
  });

  // Um link que não seja https não abre: a resposta da function é dado externo.
  it('ignora url que não seja https', async () => {
    mockInvocar.mockResolvedValue({ data: { url: 'javascript:alert(1)' } });

    await irParaOCheckout({ destino: 'desbloqueio', artistId: 'a-1' });

    expect(abrir).toHaveBeenCalledWith('https://www.maestramanager.com/artists/a-1/desbloquear');
  });
});
