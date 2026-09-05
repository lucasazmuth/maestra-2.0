import type { ArtistIdentity } from '../interfaces/maestra';

// A geometria do mapa de referências.
//
// Cada NOME que o artista escreveu vira uma bolha orbitando o nó da categoria dele, ligada a
// esse nó por um fio. Antes era um círculo por CAMPO, com a lista inteira dentro: oito nomes num
// círculo de 63px vazavam por todos os lados. Um campo de texto livre nunca ia caber num
// círculo fixo — o que cabe é um nome.
//
// Isto vivia num `useMemo` dentro da página da web. Subiu pro núcleo quando o app nativo passou
// a desenhar o mesmo mapa: são coordenadas, não JSX, e manter duas cópias de trigonometria
// afinada na tela é como as duas superfícies passam a desenhar diagramas diferentes.
//
// Quase todo número aqui foi MEDIDO na tela, não escolhido — os comentários dizem contra o quê.

/** Metade do nó grande (116px de diâmetro no CSS). */
const RAIO_DO_NO = 58;
/** Metade da bolha (54px). */
const RAIO_DA_BOLHA = 27;

export type ChaveDeReferencia = 'artistica' | 'career' | 'communication';

export interface BolhaDeReferencia {
  nome: string;
  chave: ChaveDeReferencia;
  /** Deslocamento do centro do mapa, em px. */
  x: number;
  y: number;
  /** O fio do nó até a bolha, já aparado nas duas pontas. */
  linha: { x: number; y: number; comprimento: number; ang: number };
}

/** O artista separa os nomes como quiser: vírgula, ponto e vírgula, quebra de linha ou ponto. */
const partir = (t?: string) => (t || '').split(/[,;\n·]+/).map((x) => x.trim()).filter(Boolean);

// Cada grupo ocupa o SETOR do próprio nó: artísticas em cima à direita, gestão embaixo à
// direita, comunicação embaixo à esquerda. O quadrante de POSICIONAMENTO fica livre porque não
// existe campo de referência para ele.
const GRUPOS = [
  { chave: 'artistica', campo: 'artisticas', graus: -45, no: { x: 92, y: -88 } },
  { chave: 'career', campo: 'gestao', graus: 45, no: { x: 92, y: 88 } },
  { chave: 'communication', campo: 'comunicacao', graus: 135, no: { x: -92, y: 88 } },
] as const;

// Duas elipses. As duas restrições que definem os raios, ambas medidas na tela: a de dentro
// precisa passar longe dos nós, e a distância ENTRE as duas precisa caber um diâmetro de bolha
// inteiro — aproximar a de dentro só troca uma colisão pela outra. A de dentro fica quase
// circular: achatada (ry bem menor que rx), a ponta "de pé" do setor descia sobre o nó.
const anel = (fora: boolean) => (fora ? { rx: 330, ry: 310 } : { rx: 245, ry: 235 });

export const mapaDeReferencias = (identidade?: ArtistIdentity): BolhaDeReferencia[] => {
  const refs = identidade?.references;

  return GRUPOS.flatMap(({ chave, campo, graus, no }) => {
    const nomes = partir(refs?.[campo]);
    if (!nomes.length) return [];

    // Cada setor usa DUAS FILEIRAS. Com uma só, oito nomes num arco de 80 graus se sobrepunham.
    // Duas dobram a capacidade sem alargar o setor e sem invadir o quadrante vizinho — e a de
    // fora leva mais, porque tem mais arco disponível.
    const qtdFora = nomes.length <= 4 ? nomes.length : Math.ceil(nomes.length * 0.6);
    const fileiras = [
      { fora: true, itens: nomes.slice(0, qtdFora) },
      { fora: false, itens: nomes.slice(qtdFora) },
    ].filter((f) => f.itens.length > 0);

    return fileiras.flatMap(({ fora, itens }) => {
      const { rx, ry } = anel(fora);
      // 70 graus é o setor útil, deixando 20 de vão entre um grupo e o seguinte. Com 80, as
      // bolhas das pontas de setores vizinhos se encostavam: 6px de sobreposição, medido.
      const abertura = Math.min(26 * (itens.length - 1), 70);

      return itens.map((nome, i) => {
        const desvio = itens.length === 1 ? 0 : (i / (itens.length - 1) - 0.5) * abertura;
        const rad = ((graus + desvio) * Math.PI) / 180;
        const x = rx * Math.cos(rad);
        const y = ry * Math.sin(rad);

        const dx = x - no.x;
        const dy = y - no.y;
        const dist = Math.hypot(dx, dy);

        return {
          nome,
          chave,
          x,
          y,
          linha: {
            x: no.x + (RAIO_DO_NO * dx) / dist,
            y: no.y + (RAIO_DO_NO * dy) / dist,
            comprimento: Math.max(0, dist - RAIO_DO_NO - RAIO_DA_BOLHA),
            ang: (Math.atan2(dy, dx) * 180) / Math.PI,
          },
        };
      });
    });
  });
};
