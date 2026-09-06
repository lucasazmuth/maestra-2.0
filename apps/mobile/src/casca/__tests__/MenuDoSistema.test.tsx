import type { ReactElement } from 'react';

import { COR, COR_PERFIS } from '@maestra/core/constants/design';

import { itensDoSistema, topoDoPainel } from '@/casca/marca/MenuDoSistema';

// O painel que o botão de grade abre. Três defeitos que apareceram no aparelho e que este
// arquivo existe para não deixar voltar.

const acoes = {
  perfis: jest.fn(), configuracoes: jest.fn(), suporte: jest.fn(), sair: jest.fn(),
};

/** A cor com que cada ícone foi criado — é a prop do elemento, não um estilo herdado. */
const corDoIcone = (icone: React.ReactNode) =>
  (icone as ReactElement<{ color?: string }>).props.color;

describe('menu do sistema', () => {
  // Era `top: 96` fixo. Num iPhone com ilha dinâmica a margem de cima sozinha passa de 50 e o
  // botão de grade termina em 109 — o painel abria por cima do botão que o chamou.
  describe('onde o painel começa', () => {
    it('abre abaixo do cabeçalho num aparelho com ilha dinâmica', () => {
      expect(topoDoPainel(59)).toBe(137);
    });

    it('acompanha a margem, em vez de um número fixo', () => {
      expect(topoDoPainel(47)).toBe(125);
      expect(topoDoPainel(20)).toBe(98);
    });
  });

  // O item aceso pintava só o TEXTO de azul e deixava o ícone cinza: metade do item aceso lê
  // como defeito, não como estado.
  it('o item aceso pinta o ícone junto com o rótulo', () => {
    const [perfis, configuracoes] = itensDoSistema(acoes, 'perfis');

    expect(perfis.ativo).toBe(true);
    expect(corDoIcone(perfis.icone)).toBe(COR.primaria);
    expect(configuracoes.ativo).toBe(false);
    expect(corDoIcone(configuracoes.icone)).toBe(COR_PERFIS.painelIcone);
  });

  it('sem tela ativa, nenhum ícone fica aceso', () => {
    for (const item of itensDoSistema(acoes)) {
      expect(corDoIcone(item.icone)).toBe(COR_PERFIS.painelIcone);
    }
  });

  // Vermelho promete destruição, e sair não apaga nada. Quem destrói é "Excluir minha conta",
  // nas Configurações, e lá a cor de perigo continua.
  it('"Sair da conta" não é vermelho', () => {
    const sair = itensDoSistema(acoes).find((i) => i.rotulo === 'Sair da conta');

    expect(sair).toBeDefined();
    expect(corDoIcone(sair!.icone)).not.toBe(COR.erro);
    expect(Object.keys(sair!)).not.toContain('perigo');
  });
});
