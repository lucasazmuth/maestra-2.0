import { render } from '@testing-library/react-native';

import type { TomDoSelo } from '@/nucleo/assinatura';
import { SeloDoPlano } from '@/casca/marca/SeloDoPlano';

// A pílula do plano no cabeçalho, com DOIS estados em vez dos três da web.
//
// FREE não entra: uma pílula "FREE" que leva ao checkout é direcionar para fora da loja, que é
// o que a App Store proíbe na 3.1.3. Sobram os dois que são informação sobre a conta.

let mockTom: TomDoSelo | null = null;

jest.mock('@/nucleo/assinatura', () => ({
  useTomDoSelo: () => mockTom,
}));

const montar = (tom: TomDoSelo | null) => {
  mockTom = tom;
  return render(<SeloDoPlano />);
};

describe('selo do plano', () => {
  it('diz PRO para quem assina', async () => {
    const tela = await montar('pro');

    expect(tela.getByText('PRO')).toBeTruthy();
    expect(tela.getByLabelText('Maestra Pro ativo')).toBeTruthy();
  });

  // Quem está aqui pagou e espera a confirmação. Dizer que o acesso segue liberado é o que
  // evita a ligação para o suporte.
  it('diz Pendente enquanto o pagamento não confirma, sem assustar', async () => {
    const tela = await montar('pending');

    expect(tela.getByText('Pendente')).toBeTruthy();
    expect(tela.getByLabelText('Pagamento em confirmação, seu acesso segue liberado')).toBeTruthy();
  });

  it('não desenha nada para quem não paga', async () => {
    const tela = await montar(null);

    expect(tela.queryByText('PRO')).toBeNull();
    expect(tela.queryByText('Pendente')).toBeNull();
    // Nem uma casca vazia: o cabeçalho não pode ganhar um buraco no lugar da pílula.
    expect(tela.toJSON()).toBeNull();
  });

  // Não leva a lugar nenhum: quem não assina encontra o convite no menu do sistema, e quem já
  // paga não tem o que comprar.
  it('não é um caminho para o checkout', async () => {
    for (const tom of ['pro', 'pending'] as const) {
      const tela = await montar(tom);
      expect(tela.queryByRole('button')).toBeNull();
    }
  });
});
