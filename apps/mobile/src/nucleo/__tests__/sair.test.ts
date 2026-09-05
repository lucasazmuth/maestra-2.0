import { sair } from '../entrar';

// SAIR É DESTE APARELHO, NÃO DA CONTA.
//
// O `signOut` do Supabase é GLOBAL por padrão: ele revoga todas as sessões do usuário. Com uma
// superfície só isso nunca apareceu. Com o app, a mesma conta vive em dois lugares — e o repasse
// para o checkout põe a pessoa logada também no navegador do telefone.
//
// Aconteceu de verdade: um "sair" no navegador derrubou o aplicativo, e os logs mostraram as
// chamadas seguintes com `session_not_found`. Não havia nada na tela ligando uma coisa à outra.

const mockSignOut = jest.fn();
jest.mock('@maestra/core/lib/supabase', () => ({
  supabase: { auth: { signOut: (...a: unknown[]) => mockSignOut(...a) } },
}));

describe('sair', () => {
  it('encerra só a sessão deste aparelho', async () => {
    mockSignOut.mockResolvedValue({ error: null });

    await sair();

    expect(mockSignOut).toHaveBeenCalledWith({ scope: 'local' });
  });
});
