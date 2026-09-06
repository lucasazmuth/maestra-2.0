import type { ReactElement } from 'react';

import { COR, COR_PERFIS } from '@maestra/core/constants/design';

import { comDiagnostico } from '@/app/__tests__/fixtures';
import { FotoDoArtista } from '@/casca/FotoDoArtista';
import { DiamanteAnimado } from '@/casca/marca/DiamanteAnimado';
import { itensDoSistema, topoDoPainel } from '@/casca/marca/MenuDoSistema';

// O painel que o botão de grade abre. Três defeitos que apareceram no aparelho e que este
// arquivo existe para não deixar voltar.

const acoes = {
  perfis: jest.fn(), configuracoes: jest.fn(), suporte: jest.fn(), sair: jest.fn(),
  pro: jest.fn(),
};

const rotulos = (...args: Parameters<typeof itensDoSistema>) =>
  itensDoSistema(...args).map((i) => i.rotulo);

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

  // Quem está dentro de um artista não vai ali para ver uma lista: vai para SAIR deste e entrar
  // noutro. E o ícone vira a foto de quem está aberto, que diz de quem é a sessão sem um toque.
  describe('o primeiro item', () => {
    it('diz "Trocar perfil"', () => {
      expect(itensDoSistema(acoes)[0].rotulo).toBe('Trocar perfil');
    });

    it('com um artista aberto, mostra a foto dele no lugar do ícone', () => {
      const [trocar] = itensDoSistema(acoes, undefined, comDiagnostico);

      expect((trocar.icone as ReactElement).type).toBe(FotoDoArtista);
      expect((trocar.icone as ReactElement<{ artista?: unknown }>).props.artista)
        .toBe(comDiagnostico);
    });

    it('sem artista aberto, continua no ícone', () => {
      const [trocar] = itensDoSistema(acoes);

      expect((trocar.icone as ReactElement).type).not.toBe(FotoDoArtista);
    });

    // Na própria lista de perfis o item só fecharia o menu e deixaria a pessoa onde já estava.
    // Um item que não leva a lugar nenhum ensina a desconfiar do menu inteiro.
    it('some quando já se está na lista de perfis', () => {
      expect(rotulos(acoes, 'perfis')).not.toContain('Trocar perfil');
      expect(rotulos(acoes)).toContain('Trocar perfil');
    });
  });

  // O caminho para o PRO desceu do cabeçalho para cá: era a pílula do plano ao lado da marca,
  // que agora é só da web. O diamante é o MESMO Lottie que a pílula usava.
  describe('"Seja PRO"', () => {
    it('entra na lista, com o diamante animado', () => {
      const pro = itensDoSistema(acoes).find((i) => i.rotulo === 'Seja PRO');

      expect(pro).toBeDefined();
      expect((pro!.icone as ReactElement).type).toBe(DiamanteAnimado);
      expect((pro!.icone as ReactElement<{ tom?: string }>).props.tom).toBe('pro');
    });

    it('leva ao lugar que quem chamou mandou', () => {
      const pro = itensDoSistema(acoes).find((i) => i.rotulo === 'Seja PRO');
      pro!.aoTocar();

      expect(acoes.pro).toHaveBeenCalled();
    });

    it('aparece também na lista de perfis, onde a pílula vivia', () => {
      expect(rotulos(acoes, 'perfis')).toContain('Seja PRO');
    });
  });

  // O item aceso pintava só o TEXTO de azul e deixava o ícone cinza: metade do item aceso lê
  // como defeito, não como estado.
  it('o item aceso pinta o ícone junto com o rótulo', () => {
    const itens = itensDoSistema(acoes, 'configuracoes');
    const configuracoes = itens.find((i) => i.rotulo === 'Configurações')!;
    const suporte = itens.find((i) => i.rotulo === 'Suporte')!;

    expect(configuracoes.ativo).toBe(true);
    expect(corDoIcone(configuracoes.icone)).toBe(COR.primaria);
    expect(suporte.ativo).toBeUndefined();
    expect(corDoIcone(suporte.icone)).toBe(COR_PERFIS.painelIcone);
  });

  it('sem tela ativa, nenhum ícone fica aceso', () => {
    // O "Seja PRO" fica de fora: o diamante é um Lottie, não um ícone de traço com cor.
    for (const item of itensDoSistema(acoes).filter((i) => i.rotulo !== 'Seja PRO')) {
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
