import fs from 'fs';
import path from 'path';

import { COR_DIAGNOSTICO } from '@maestra/core/constants/design';

// A TRANSIÇÃO DE BLOCO SE LÊ, NAS DUAS SUPERFÍCIES.
//
// A frase da Nyta que abre cada assunto do quiz (v4.2, §2) estava BRANCA na web: escrita para a
// base escura do topo do módulo (`#121212`), e essa base morreu quando a regra de `.pageReal`
// passou a repintar o quiz de `#f7f8fb`. Branco a 72% sobre esse claro dá 1,04:1 de contraste.
// Ninguém viu durante semanas porque o texto continuava lá, no DOM, ocupando a altura certa.
//
// O app nunca teve o problema: ele usa o `criarAjuda` do design system nesta mesma frase. Foi a
// web que derivou, e é essa derivação que este teste prende.
//
// Lê o ficheiro porque uma cor errada não falha render nenhum. Só aparece na tela.

const folha = fs.readFileSync(
  path.join(__dirname, '..', 'pages', 'ArtistCreate', 'ArtistCreate.module.scss'), 'utf8',
);

/** O corpo da regra `.transicao`, sem as aninhadas dentro dela. */
const regraDaTransicao = (() => {
  const i = folha.indexOf('\n.transicao {');
  return i < 0 ? '' : folha.slice(i, folha.indexOf('\n}', i));
})();

describe('cromo do quiz do diagnóstico', () => {
  it('a regra da transição existe', () => {
    expect(regraDaTransicao).toContain('font-size');
  });

  it('a transição usa o MESMO tom que o app usa na mesma frase', () => {
    expect(regraDaTransicao).toContain(`color: ${COR_DIAGNOSTICO.criarAjuda};`);
  });

  // ⚠️ E NENHUM BRANCO, que é a forma exata que o defeito tinha.
  it('a transição não volta a ser branca', () => {
    expect(regraDaTransicao).not.toMatch(/color:\s*(#fff|#ffffff|white|rgba?\(\s*255\s*,\s*255\s*,\s*255)/i);
  });

  // O contraste mínimo que a cor entrega sobre o fundo do quiz. Não é um alvo de acessibilidade
  // (3,24:1 fica abaixo do 4,5:1 que a WCAG pede para texto normal): é um piso que impede a
  // frase de voltar a ser ilegível sem ninguém reparar.
  it('a cor da transição se distingue do fundo do quiz', () => {
    const luz = (hex: string) => {
      const h = hex.replace('#', '');
      const c = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) / 255)
        .map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
      return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
    };
    const a = luz(COR_DIAGNOSTICO.criarAjuda);
    const b = luz('#f7f8fb');
    const razao = (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);

    expect(razao).toBeGreaterThan(3);
  });
});
