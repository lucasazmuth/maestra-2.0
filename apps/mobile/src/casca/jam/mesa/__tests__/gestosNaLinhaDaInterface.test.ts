import fs from 'fs';
import path from 'path';

// O QUE PODE CORRER DENTRO DE UM GESTO.
//
// ⚠️ O CORPO DE UM GESTO É UM *WORKLET*: corre na linha da interface, noutro motor de
// JavaScript, onde as funções do módulo não existem. Chamar uma delas lá dentro rebenta com
// "Tried to synchronously call a Remote Function" — e rebenta SÓ NO APARELHO, porque nos testes
// o `reanimated` é um duplo em que tudo corre na mesma linha.
//
// Foi assim que o fader da Mesa chegou ao aparelho quebrado: `runOnJS(aoMudar)(paraValor(e.y))`
// parece certo de relance — há um `runOnJS` ali — mas quem atravessa a fronteira é só o
// `aoMudar`; o `paraValor` era chamado do outro lado. Nenhuma prova de comportamento podia
// apanhá-lo, e por isso esta é de código-fonte.
//
// A regra: dentro de um gesto, a única coisa que se chama é `runOnJS(…)(…)`. O que for preciso
// calcular calcula-se do lado do JavaScript, com a coordenada crua que o gesto mandou.

const PASTA = path.join(__dirname, '..');
const GESTOS = /\.(onBegin|onUpdate|onEnd|onStart|onFinalize|onTouchesDown|onTouchesMove)\(/g;

/** Da chaveta que abre até à que fecha, contando as de dentro. */
const corpoDe = (fonte: string, abre: number): string => {
  let nivel = 0;
  for (let i = abre; i < fonte.length; i += 1) {
    if (fonte[i] === '{') nivel += 1;
    if (fonte[i] === '}') {
      nivel -= 1;
      if (nivel === 0) return fonte.slice(abre + 1, i);
    }
  }
  throw new Error('Chaveta sem fecho.');
};

/** Os corpos de todos os gestos de um ficheiro. */
const gestosDe = (fonte: string): string[] => {
  const corpos: string[] = [];
  for (const achado of fonte.matchAll(GESTOS)) {
    const abre = fonte.indexOf('{', achado.index!);
    // Um gesto de uma expressão só (`=> algo`) não tem corpo em chavetas; os deste projeto têm.
    const ateAoFim = fonte.indexOf(';', achado.index!);
    if (abre === -1 || abre > ateAoFim + 200) continue;
    corpos.push(corpoDe(fonte, abre));
  }
  return corpos;
};

const ficheiros = fs.readdirSync(PASTA)
  .filter((n) => n.endsWith('.tsx'))
  .map((n) => [n, fs.readFileSync(path.join(PASTA, n), 'utf8')] as const)
  .filter(([, fonte]) => GESTOS.test(fonte) || /\.onUpdate\(/.test(fonte));

describe('o que corre dentro de um gesto', () => {
  it('há gestos para conferir', () => {
    expect(ficheiros.length).toBeGreaterThan(0);
    expect(ficheiros.flatMap(([, f]) => gestosDe(f)).length).toBeGreaterThanOrEqual(6);
  });

  it.each(ficheiros)('%s só chama funções através do runOnJS', (_nome, fonte) => {
    gestosDe(fonte).forEach((corpo) => {
      const limpo = corpo
        // ⚠️ TIRA O INVÓLUCRO, E NÃO A CHAMADA INTEIRA. A primeira versão apagava
        // `runOnJS(algo)(…)` de uma vez, com um `[^)]*` nos argumentos — e esse `[^)]*` parava
        // no primeiro parêntese fechado, engolindo a chamada ANINHADA junto. Era exatamente o
        // defeito que este ficheiro existe para apanhar, e ele passava: as três mutações que o
        // repunham sobreviviam. Tirando só o nome, o argumento fica à vista.
        .replace(/runOnJS\([A-Za-z0-9_.]+\)/g, '')
        // `Math.*` existe nos dois motores — é do próprio JavaScript, e não do módulo.
        .replace(/Math\.[a-z]+\(/gi, '(')
        .replace(/\/\/.*$/gm, '');

      // O que sobra não pode ter chamada nenhuma: `nome(` é uma função deste lado a ser
      // chamada do outro. As palavras da LINGUAGEM não contam — `if (` não é uma chamada, e a
      // primeira versão disto acusou o `LinhaDoTempo` por causa dela.
      const DA_LINGUAGEM = /^(if|for|while|switch|catch|return|typeof|function|await)$/;
      const chamadas = (limpo.match(/[A-Za-z_$][\w$]*\s*\(/g) ?? [])
        .map((c) => c.replace(/\s*\($/, ''))
        .filter((c) => !DA_LINGUAGEM.test(c));
      expect(chamadas).toEqual([]);
    });
  });
});
