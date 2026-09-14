import fs from 'fs';
import path from 'path';

// ⚠️ O QUIZ É UM SÓ, E OS DOIS RENDERIZADORES SÃO DUAS CÓPIAS DO MESMO DESENHO.
//
// A v4.5 pôs quatro regras no núcleo, e as quatro são do tipo que cada lado reescreve à mão sem
// pensar — e que falham CALADAS quando uma das cópias fica para trás:
//
//  · `gravarResposta` respeita a `sub`. As nove perguntas por fonte de receita gravam todas em
//    `outrasPorFonteFaixa`, cada uma na sua chave. Um lado a escrever `respostas[key] = valor`
//    grava a última fonte por cima das outras oito, e o artista perde oito respostas sem ver
//    nada acontecer.
//  · `gravarEscape` grava o desvio e NÃO responde a pergunta. É a ausência da resposta que o
//    motor lê como "somar as parcelas".
//  · `respostaGravada` lê de volta pela mesma regra — é o que o "Voltar" usa.
//  · `posicaoNaTrilha` deixa o detalhamento de fora, e é o que faz a barra congelar em vez de
//    recuar.
const raiz = path.join(__dirname, '..', '..');
const SUPERFICIES: [string, string][] = [
  ['web', path.join(raiz, 'src', 'pages', 'ArtistCreate', 'index.tsx')],
  ['app', path.join(raiz, 'apps', 'mobile', 'src', 'app', 'criar-artista.tsx')],
];
const fontes = SUPERFICIES.map(([nome, p]) => [nome, fs.readFileSync(p, 'utf8')] as const);

describe('o quiz nas duas superfícies', () => {
  it.each(fontes)('a %s grava e lê a resposta pelo núcleo', (_nome, fonte) => {
    expect(fonte).toMatch(/gravarResposta\(/);
    expect(fonte).toMatch(/respostaGravada\(/);
  });

  // ⚠️ A CHAMADA, E NÃO A MENÇÃO: o nome fica na linha do `import` mesmo depois de o
  // renderizador voltar a escrever na chave à mão, e a asserção pelo nome deixava passar.
  // O `CTX_API` é a exceção legítima: é o contexto da consulta prévia, depositado antes de o quiz
  // começar, e não a resposta de pergunta nenhuma.
  it.each(fontes)('e a %s não escreve na chave da resposta por conta própria', (_nome, fonte) => {
    expect(fonte).not.toMatch(/(answers|respostas)\.current\[(?!CTX_API)[^\]]+\]\s*=[^=]/);
  });

  it.each(fontes)('a %s abre o desvio pelo núcleo, sem responder a pergunta', (_nome, fonte) => {
    expect(fonte).toMatch(/gravarEscape\(/);
    // A chave de controlo não é escrita à mão em lado nenhum.
    expect(fonte).not.toContain("'_detalhar'");
    expect(fonte).not.toContain("'_fontes'");
  });

  it.each(fontes)('e a barra da %s mede pela trilha do núcleo', (_nome, fonte) => {
    expect(fonte).toMatch(/posicaoNaTrilha\(/);
    expect(fonte).toMatch(/totalDaTrilha\(/);
    // Nada de medir pelo índice cru: o detalhamento tem de ficar fora dos dois lados da fração.
    expect(fonte).not.toMatch(/QUIZ\.length\s*\)\s*\*\s*100/);
  });
});
