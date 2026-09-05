import fs from 'fs';
import path from 'path';

// A FOLHA do PDF: A4 nos dois lados da conta.
//
// O deck é desenhado em pixels (794×1120), e ao imprimir o WebKit converte 1px em 0,75pt — os
// 794px dão exatamente a largura do A4. Mas o TAMANHO DO PAPEL não vem do `@page` do CSS: vem
// da chamada do `expo-print`, e o padrão dela é Carta (612×792pt), que é mais baixa que o A4.
//
// Com a folha errada cada página do deck vazava para uma segunda e o PDF saía com 24 páginas,
// metade em branco. O arquivo abria, tinha o conteúdo certo e ninguém notaria sem contar as
// páginas — por isso as duas medidas ficam amarradas aqui.

const raiz = path.join(__dirname, '..', '..', '..', '..');
const html = fs.readFileSync(
  path.join(raiz, 'packages', 'core', 'src', 'documentos', 'diagnosticoHtml.ts'), 'utf8',
);
const impressao = fs.readFileSync(
  path.join(__dirname, '..', 'nucleo', 'documentos.ts'), 'utf8',
);

const A4_EM_PONTOS = { largura: 595, altura: 842 };
const PONTO_POR_PIXEL = 0.75;

describe('a folha do PDF do diagnóstico', () => {
  it('a página do deck cabe num A4', () => {
    const medida = html.match(/width: (\d+)px; height: (\d+)px; background: #fff/);
    const largura = Number(medida?.[1]);
    const altura = Number(medida?.[2]);

    expect(largura * PONTO_POR_PIXEL).toBeLessThanOrEqual(A4_EM_PONTOS.largura);
    expect(altura * PONTO_POR_PIXEL).toBeLessThanOrEqual(A4_EM_PONTOS.altura);
    // E não sobra folha à toa: a página ocupa o que tem.
    expect(altura * PONTO_POR_PIXEL).toBeGreaterThan(A4_EM_PONTOS.altura - 6);
  });

  it('o app manda o papel A4 para o expo-print', () => {
    expect(impressao).toContain(`largura: ${A4_EM_PONTOS.largura}`);
    expect(impressao).toContain(`altura: ${A4_EM_PONTOS.altura}`);
    expect(impressao).toMatch(/width: A4\.largura/);
    expect(impressao).toMatch(/height: A4\.altura/);
  });
});
