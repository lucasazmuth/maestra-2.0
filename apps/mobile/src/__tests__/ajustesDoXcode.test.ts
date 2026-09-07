// O plugin que reescreve o projeto do Xcode a cada `expo prebuild`.
//
// Estes dois valores ja se perderam uma vez, quando viviam so no `project.pbxproj` — que e
// arquivo gerado e fora do Git. O teste existe para que a perda volte a ser barulhenta: se
// alguem mexer no plugin e a caixa de areia voltar a ficar ligada, o build do iOS quebra com
// cinco negacoes de leitura que nao mencionam a causa, e isso custa uma noite.

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { AJUSTES, aplicarAjustes } = require('../../plugins/ajustesDoXcode');

type Configuracao = { name?: string; buildSettings?: Record<string, string> };

/** Espelha o formato do `pbxXCBuildConfigurationSection()` da biblioteca `xcode`. */
const secaoDeExemplo = () => ({
  '13B07F941A680F5B00A75B9A': { name: 'Debug', buildSettings: { PRODUCT_NAME: 'Maestra' } },
  '13B07F941A680F5B00A75B9A_comment': 'Debug',
  '13B07F951A680F5B00A75B9A': { name: 'Release', buildSettings: { PRODUCT_NAME: 'Maestra' } },
  '13B07F951A680F5B00A75B9A_comment': 'Release',
});

const projetoFalso = (secao: Record<string, unknown>) => ({
  pbxXCBuildConfigurationSection: () => secao,
});

describe('ajustes do projeto do Xcode', () => {
  it('desliga a caixa de areia dos scripts e fixa o time em toda configuracao', () => {
    const secao = secaoDeExemplo();
    const alteradas = aplicarAjustes(projetoFalso(secao));

    expect(alteradas).toBe(2);
    for (const nome of ['13B07F941A680F5B00A75B9A', '13B07F951A680F5B00A75B9A'] as const) {
      const configuracao = secao[nome] as Configuracao;
      // NAO e so "existe": e o valor. `YES` aqui derruba a fase que gera o `main.jsbundle`.
      expect(configuracao.buildSettings?.ENABLE_USER_SCRIPT_SANDBOXING).toBe('NO');
      expect(configuracao.buildSettings?.DEVELOPMENT_TEAM).toBe('NX83Q24CXV');
    }
  });

  it('preserva o que ja estava na configuracao', () => {
    const secao = secaoDeExemplo();
    aplicarAjustes(projetoFalso(secao));

    expect((secao['13B07F941A680F5B00A75B9A'] as Configuracao).buildSettings?.PRODUCT_NAME)
      .toBe('Maestra');
  });

  it('ignora as entradas `_comment`, que sao texto e nao configuracao', () => {
    const secao = secaoDeExemplo();

    expect(() => aplicarAjustes(projetoFalso(secao))).not.toThrow();
    expect(secao['13B07F941A680F5B00A75B9A_comment']).toBe('Debug');
  });

  it('nao inventa chave nenhuma alem das duas', () => {
    expect(Object.keys(AJUSTES).sort())
      .toEqual(['DEVELOPMENT_TEAM', 'ENABLE_USER_SCRIPT_SANDBOXING']);
  });
});
