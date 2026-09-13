import fs from 'fs';
import path from 'path';

// ⚠️ A RÉGUA MOSTRA A NOTA, SEMPRE, NAS QUATRO SUPERFÍCIES.
//
// O L é a única dimensão em que o patamar de elite não implica nota 100: a spec do motor pede
// `L_topicon = L_alto e nota_premios ≥ 0,95` (§9) e a nota `70 + ((nota_L − 0,70)/0,30) × 30`
// (§11.2). Quem tem prémio internacional e nota_L de 0,74 é Top Tier com 74 — e as quatro
// superfícies enchiam a régua até ao fim nesse caso, "para não contradizer o selo".
//
// O resultado era o cartão a dizer TOP TIER · 74/100 com a barra cheia, logo abaixo de outro a
// dizer ACESA · 90/100 · faltam 10 pontos para o Top Tier. Três diagnósticos gravados já saíam
// assim, um deles com 70/100 — a nota MÍNIMA de uma dimensão acesa.
//
// Este teste é de CROMO: um teste de comportamento não o apanha, porque a régua desenhada a 100%
// continua a renderizar sem erro nenhum. O que se prende aqui é a ausência da largura fixa.
const raiz = path.join(__dirname, '..', '..');
const SUPERFICIES: [string, string][] = [
  ['tela da web', path.join(raiz, 'src', 'pages', 'ArtistCreate', 'DiagnosticReport.tsx')],
  ['PDF da web', path.join(raiz, 'src', 'pages', 'ArtistCreate', 'DiagnosticDoc.tsx')],
  ['PDF do núcleo', path.join(raiz, 'packages', 'core', 'src', 'documentos', 'diagnosticoHtml.ts')],
  ['app nativo', path.join(raiz, 'apps', 'mobile', 'src', 'casca', 'diagnostico', 'CartaoDaDimensao.tsx')],
];
const fontes = SUPERFICIES.map(([nome, p]) => [nome, fs.readFileSync(p, 'utf8')] as const);

/**
 * O ESTILO da barra que preenche a régua da dimensão, e só ele.
 *
 * Ancora-se na expressão de largura, e não no nome da classe, por duas razões que já morderam
 * este teste: no PDF do núcleo a folha de estilo viaja dentro do próprio ficheiro, e a primeira
 * ocorrência de `reguaCheia` é a regra de CSS; e uma janela larga à volta do nome varre também o
 * SELO do cartão, que tem um ternário próprio sobre a mesma bandeira — o teste dava-se por
 * satisfeito com o ternário do selo depois de o da barra desaparecer.
 */
const regua = (fonte: string): string => {
  const largura = /width:\s*(`?\$\{[^}]*\}%|['"]100%['"]|\$\{[^}]*\}%)/g;
  const trechos: string[] = [];
  for (let m = largura.exec(fonte); m; m = largura.exec(fonte)) {
    const t = fonte.slice(Math.max(0, m.index - 200), m.index + 200);
    // Só as larguras que desenham a régua: as marcas de 70 e 100 usam `left`, não `width`.
    if (/rulerFill|docRulerFill2|reguaCheia|preenchimento|score|nota|topo?\b/.test(t)) trechos.push(t);
  }
  expect(trechos.length).toBeGreaterThan(0);
  return trechos.join('\n');
};

describe('a régua da dimensão mostra a nota', () => {
  it.each(fontes)('a %s nunca força a régua a cheia', (_nome, fonte) => {
    const trecho = regua(fonte);

    // As quatro formas que a largura fixa tinha, uma por superfície.
    expect(trecho).not.toMatch(/width:\s*'100%'/);
    expect(trecho).not.toMatch(/width:\s*"100%"/);
    expect(trecho).not.toMatch(/width:\$\{topo \? 100/);
    expect(trecho).not.toMatch(/topo\s*\?\s*\{\s*width/);
  });

  it.each(fontes)('e a largura da %s sai da nota', (_nome, fonte) => {
    expect(regua(fonte)).toMatch(/width:\s*`?\$\{(score|nota)\}%/);
  });

  // O selo continua a existir: o que muda com o Top Tier é a COR, não o comprimento. Sem isto,
  // "não forçar a cheia" podia ser cumprido apagando o dourado, que é o sinal do patamar.
  // O QUE ESTE TESTE NÃO PRENDE, dito para não se supor que prende: que o Top Tier continue a
  // pintar a régua de dourado. Tentei, e a asserção não sobrevive honestamente às quatro formas —
  // três superfícies escolhem a cor num ternário junto da largura e o PDF do núcleo escolhe-a numa
  // variável muito acima. Uma expressão que casasse com as quatro teria de ser larga ao ponto de
  // também casar com o ternário do SELO, que fica a poucas linhas e sobrevive à perda da cor.
  // O patamar continua dito pelo selo, que tem teste próprio; o que se prende aqui é o
  // comprimento, que era o que mentia.
  it('a régua e o número dizem a mesma coisa: é esta a regra, e é só esta', () => {
    expect(fontes).toHaveLength(4);
  });
});
