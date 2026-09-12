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
//
// ⚠️ E OS GESTOS NÃO SÃO A ÚNICA PORTA. O corpo de um `useAnimatedStyle`, de um
// `useAnimatedReaction` ou de um `useFrameCallback` é igualmente um worklet — e foi por aí que o
// defeito voltou a entrar, meses depois: um estilo animado que chamava a conta do núcleo para
// colocar a barra do clipe rebentou no aparelho com a MESMA mensagem, com esta lista a olhar
// para o outro lado. Uma regra que só vigia uma das portas dá a sensação de estar coberta.
const GESTOS = /(\.(onBegin|onUpdate|onEnd|onStart|onFinalize|onTouchesDown|onTouchesMove)|useAnimatedStyle|useAnimatedReaction|useFrameCallback|useDerivedValue|runOnUI)\(/g;

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
    // Um `useAnimatedStyle(() => ({ ... }))` devolve um objeto: a primeira chaveta é a dele.
    if (abre === -1 || abre > ateAoFim + 200) continue;
    corpos.push(corpoDe(fonte, abre));
  }
  return corpos;
};

const ficheiros = fs.readdirSync(PASTA)
  .filter((n) => n.endsWith('.tsx'))
  .map((n) => [n, fs.readFileSync(path.join(PASTA, n), 'utf8')] as const)
  .filter(([, fonte]) => GESTOS.test(fonte) || /\.onUpdate\(/.test(fonte));

// ⚠️ O `lastIndex` DE UM REGEXP GLOBAL SOBREVIVE ENTRE CHAMADAS, e o `.test()` de cima deixa-o
// onde parou: sem o repor, o `matchAll` de baixo começava a meio do ficheiro e metade dos corpos
// ficava por conferir. É a armadilha clássica do `/g`, e aqui ela seria silenciosa.
GESTOS.lastIndex = 0;

/**
 * Os nomes que VÊM do reanimated, incluindo os renomeados na importação.
 *
 * ⚠️ ELES SÃO WORKLETS POR CONSTRUÇÃO, e chamá-los do lado de lá é o que se deve fazer — o
 * `scrollTo` dele, por exemplo, existe para ser pedido na linha da interface. Sem esta leitura, a
 * regra acusava-o e a única saída seria voltar ao `scrollTo` do JavaScript, que perde pedidos.
 *
 * Lidos da própria importação, e não de uma lista escrita aqui: uma lista à mão envelhece no dia
 * em que o ficheiro passar a usar mais um, e o sintoma seria um teste vermelho sobre código são.
 */
const doReanimated = (fonte: string): string[] => {
  // ⚠️ O `Animated,` ANTES DAS CHAVETAS. A primeira versão disto exigia a chaveta logo a seguir
  // ao `import` e devolvia vazio para `import Animated, { … }` — que é exatamente como este
  // projeto importa. A regra ficava a acusar as chamadas legítimas.
  const bloco = fonte.match(
    /import\s*(?:[A-Za-z_$][\w$]*\s*,\s*)?\{([^}]*)\}\s*from\s*'react-native-reanimated'/,
  );
  if (!bloco) return [];
  return bloco[1]
    .split(',')
    .map((peca) => peca.trim())
    // `scrollTo as rolarNaInterface` — o nome que conta é o de cá.
    .map((peca) => (peca.includes(' as ') ? peca.split(' as ')[1] : peca))
    .map((peca) => peca.replace(/^type\s+/, '').trim())
    .filter(Boolean);
};

describe('o que corre dentro de um worklet', () => {
  it('há gestos e estilos animados para conferir', () => {
    expect(ficheiros.length).toBeGreaterThan(0);
    expect(ficheiros.flatMap(([, f]) => gestosDe(f)).length).toBeGreaterThanOrEqual(6);
  });

  // ⚠️ E OS RENOMEADOS CONTAM. `scrollTo as rolarNaInterface` é o caso deste projeto, e uma
  // leitura que só olhasse para o nome de origem acusaria a chamada legítima.
  it('a leitura da importação apanha os renomeados', () => {
    const nomes = doReanimated(
      "import Animated, { runOnJS, scrollTo as rolar, type SharedValue } from 'react-native-reanimated';",
    );
    expect(nomes).toContain('runOnJS');
    expect(nomes).toContain('rolar');
    expect(nomes).toContain('SharedValue');
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
      const doOutroLado = doReanimated(fonte);
      const chamadas = (limpo.match(/[A-Za-z_$][\w$]*\s*\(/g) ?? [])
        .map((c) => c.replace(/\s*\($/, ''))
        .filter((c) => !DA_LINGUAGEM.test(c))
        .filter((c) => !doOutroLado.includes(c));
      expect(chamadas).toEqual([]);
    });
  });
});
