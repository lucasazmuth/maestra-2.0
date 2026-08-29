// O markdown que a Nyta escreve, em pedaços que a tela sabe desenhar.
//
// A Nyta responde em markdown: negrito para destacar o nome de uma estratégia, listas para
// enumerar passos. Na web o `react-markdown` cuida disso. No app não há equivalente confiável —
// a biblioteca da vez está parada desde 2023 e carrega `markdown-it@10` e `prop-types` —, então
// aqui o núcleo faz o PARSE e a tela desenha com `<Text>`.
//
// O subconjunto é DECLARADO, e não "markdown": parágrafos, títulos, listas e ênfase, que é o
// que a Nyta de fato produz. Link, imagem, tabela e bloco de código passam como texto puro. Se
// algum dia ela passar a escrever tabelas, isto aqui precisa mudar — e é melhor que isso seja
// uma decisão do que uma surpresa.

export interface TrechoDeTexto {
  texto: string;
  negrito?: boolean;
  italico?: boolean;
}

export type BlocoDeMarkdown =
  | { tipo: 'paragrafo'; trechos: TrechoDeTexto[] }
  | { tipo: 'titulo'; nivel: 1 | 2 | 3; trechos: TrechoDeTexto[] }
  | { tipo: 'item'; marcador: string; trechos: TrechoDeTexto[] };

// `**negrito**`, `__negrito__`, `*itálico*`, `_itálico_`. A ordem importa: as duplas antes das
// simples, senão `**x**` casaria como itálico de `*x*` com asteriscos sobrando.
const ENFASE = /(\*\*|__)(.+?)\1|(\*|_)(.+?)\3/g;

/** Quebra uma linha em trechos, separando o que é ênfase do que é texto comum. */
export const trechosDaLinha = (linha: string): TrechoDeTexto[] => {
  const trechos: TrechoDeTexto[] = [];
  let ultimo = 0;

  for (const achado of linha.matchAll(ENFASE)) {
    const inicio = achado.index ?? 0;
    if (inicio > ultimo) trechos.push({ texto: linha.slice(ultimo, inicio) });

    if (achado[2] !== undefined) trechos.push({ texto: achado[2], negrito: true });
    else trechos.push({ texto: achado[4], italico: true });

    ultimo = inicio + achado[0].length;
  }

  if (ultimo < linha.length) trechos.push({ texto: linha.slice(ultimo) });
  // Linha sem nada dentro ainda é um trecho: um parágrafo vazio some, mas um item de lista
  // vazio precisa ocupar a própria linha.
  return trechos.length ? trechos : [{ texto: linha }];
};

const TITULO = /^(#{1,3})\s+(.*)$/;
const MARCADOR = /^\s*[-*+]\s+(.*)$/;
const NUMERADO = /^\s*(\d+)[.)]\s+(.*)$/;

export const markdownDaNyta = (texto: string): BlocoDeMarkdown[] => {
  const blocos: BlocoDeMarkdown[] = [];

  for (const linha of (texto ?? '').split('\n')) {
    // Linha em branco separa parágrafos; ela mesma não vira bloco.
    if (!linha.trim()) continue;

    const titulo = TITULO.exec(linha);
    if (titulo) {
      blocos.push({
        tipo: 'titulo',
        nivel: titulo[1].length as 1 | 2 | 3,
        trechos: trechosDaLinha(titulo[2]),
      });
      continue;
    }

    const numerado = NUMERADO.exec(linha);
    if (numerado) {
      blocos.push({ tipo: 'item', marcador: `${numerado[1]}.`, trechos: trechosDaLinha(numerado[2]) });
      continue;
    }

    const marcador = MARCADOR.exec(linha);
    if (marcador) {
      blocos.push({ tipo: 'item', marcador: '·', trechos: trechosDaLinha(marcador[1]) });
      continue;
    }

    blocos.push({ tipo: 'paragrafo', trechos: trechosDaLinha(linha) });
  }

  return blocos;
};
