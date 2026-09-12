import { tituloDoArquivo } from '../services/armazenamento';
import type { CatalogTrack, CatalogVersion, CatalogVersionFile } from '../interfaces/maestra';
import type { Clipe, Pista } from './mesa';

// A montagem de uma gravação, traduzida para o que a mesa toca.
//
// O banco guarda três coisas: os FICHEIROS enviados (`catalog_version_files`), as PISTAS da
// linha do tempo (`catalog_tracks`) e os CLIPES dentro delas (`catalog_clips`). A mesa só quer
// saber de pistas e clipes com URL, início, recorte e duração — esta camada faz a ponte, e é
// aqui que se resolve a única junção que o banco não traz pronta: clipe → ficheiro → URL.

/**
 * O nome da pista da mix, quando a gravação ainda não foi montada em pistas.
 *
 * ⚠️ A ESTRELA SAIU. Ela queria dizer "esta é a gravação PRINCIPAL", e essa ideia deixou de
 * existir: o que a lista de Músicas toca passou a ser a GUIA — a soma da montagem, gerada ao
 * fechar o editor —, e não uma gravação eleita entre as outras. Uma estrela a apontar para um
 * conceito que já não há é pior do que nenhuma: ela promete uma escolha que não se pode fazer.
 */
export const NOME_DA_MIX = 'Mix';
/** O id da pista que a mix ocupa. Não existe no banco: é montada na hora. */
export const ID_DA_MIX = 'mix';

export const ehPistaDaMix = (id: string): boolean => id === ID_DA_MIX;

/**
 * Para que faixa vai um clipe arrastado — `undefined` quando fica onde está.
 *
 * `paraIndice` é onde a mão aponta, e pode vir de qualquer lado: na web sai do `y` do ponteiro
 * sobre a pilha de faixas, no app sai de quantas alturas de faixa o dedo percorreu. É por isso
 * que a regra mora aqui e não em nenhuma das duas — o gesto é diferente, a decisão é a mesma.
 *
 * Três coisas que ela decide, e cada uma existe por um motivo:
 *
 *  • ARREDONDA E TRAVA no que existe. Sem o limite, arrastar para baixo da última faixa dava um
 *    índice que não existe e o clipe desaparecia da montagem até ao recarregamento seguinte.
 *  • A MIX NÃO SAI NEM RECEBE. Ela é a SOMA das camadas, montada na hora, e não tem linha no
 *    banco: mover um clipe para dentro dela seria escrever numa pista que não existe.
 *  • MESMA FAIXA É `undefined`, e não o id dela. Quem chama distingue "não mudou de faixa" de
 *    "mudou" sem ter de comparar nada — e é essa distinção que impede um toque de contar como
 *    arrasto.
 */
export const pistaAlvoDoArrasto = (
  pistas: { id: string }[],
  deIndice: number,
  paraIndice: number,
): string | undefined => {
  const origem = pistas[deIndice];
  if (!origem || ehPistaDaMix(origem.id)) return undefined;
  const alvo = pistas[Math.max(0, Math.min(Math.round(paraIndice), pistas.length - 1))];
  if (!alvo || alvo.id === origem.id || ehPistaDaMix(alvo.id)) return undefined;
  return alvo.id;
};

/**
 * Em que segundo a faixa acaba: onde o último clipe dela termina.
 *
 * ⚠️ É AQUI QUE ENTRA O ÁUDIO NOVO DE UMA FAIXA QUE JÁ TEM ÁUDIO. Antes, um take mandado para
 * uma faixa cheia nascia no segundo ZERO — em cima do que já lá estava. Dois clipes no mesmo
 * sítio tocam ao mesmo tempo e desenham-se um por cima do outro: quem enviava via a montagem
 * "engolir" o ficheiro e ouvia uma mistura que nunca pediu. Encostado ao fim, o take novo
 * aparece a seguir e pode ser arrastado para cima do outro DEPOIS, se for isso que se quer —
 * sobrepor passa a ser uma escolha, e deixa de ser o que acontece por omissão.
 *
 * ⚠️ O FIM DE CADA CLIPE, e não o do que começa mais tarde. O último a começar pode ser o mais
 * curto: um clipe de dois segundos largado no minuto 3 acaba antes de um de quatro minutos que
 * começou no zero, e usar o início mais alto punha o take novo por cima do comprido.
 *
 * Vazia, devolve 0 — que é onde o primeiro clipe de uma faixa tem de nascer.
 */
export const fimDaPista = (
  clipes: { start_seconds: number | string; duration_seconds: number | string }[] | null | undefined,
): number => (clipes ?? []).reduce((maior, c) => Math.max(
  maior,
  (Number(c.start_seconds) || 0) + (Number(c.duration_seconds) || 0),
), 0);

/**
 * A cópia de um clipe, encostada ao fim do original.
 *
 * ⚠️ COPIAR UM CLIPE NÃO COPIA ÁUDIO. Ela aponta para o MESMO ficheiro, com o mesmo recorte
 * (`offset_seconds`) e o mesmo comprimento: o que muda é só onde ela entra na linha do tempo.
 * É a mesma economia que faz o corte ser instantâneo — não há nada para enviar nem decodificar,
 * e duplicar um refrão de dois minutos custa uma linha no banco.
 *
 * ⚠️ E ELA ENTRA ONDE O ORIGINAL ACABA, colada a ele. Este é o gesto de quem está a montar uma
 * estrutura — o refrão outra vez, a base a repetir — e quem faz isso quer os dois seguidos, não
 * um por cima do outro nem um segundo à frente. Dois clipes sobrepostos no mesmo sítio soariam
 * como um só, mais alto, e pareceriam um defeito.
 *
 * Os números chegam do banco como TEXTO (`numeric` em Postgres) e por isso passam pelo `Number`:
 * sem isso, `'12' + '3'` dava um clipe a começar no segundo 123.
 */
export const copiaDoClipe = (clipe: {
  track_id: string;
  file_id: string;
  start_seconds: number | string;
  offset_seconds: number | string;
  duration_seconds: number | string;
}): {
  track_id: string;
  file_id: string;
  start_seconds: number;
  offset_seconds: number;
  duration_seconds: number;
} => {
  const inicio = Number(clipe.start_seconds) || 0;
  const duracao = Number(clipe.duration_seconds) || 0;
  return {
    track_id: clipe.track_id,
    file_id: clipe.file_id,
    start_seconds: inicio + duracao,
    offset_seconds: Number(clipe.offset_seconds) || 0,
    duration_seconds: duracao,
  };
};

/**
 * Em que lugar entra uma faixa nova: depois da última.
 *
 * ⚠️ A PRÓXIMA POSIÇÃO, e não a CONTAGEM das faixas. As duas dão o mesmo número enquanto as
 * posições forem 0, 1, 2… — e deixam de dar assim que uma gravação antiga tem a primeira faixa
 * em 1, ou assim que alguém apaga uma do meio. Aí a faixa nova nasce empatada com uma que já
 * existe, e a ordem da coluna passa a ser decidida pelo desempate da data de criação: duas
 * telas, dois momentos, duas ordens possíveis para a mesma montagem.
 */
/**
 * Quantas cores a paleta das faixas tem. É o tamanho de `CORES_DAS_PISTAS`, no design.
 *
 * Está aqui como número porque este módulo não desenha nada e não deve importar a paleta — o
 * teste é que amarra os dois.
 */
export const CORES_DA_PALETA = 6;

/**
 * A cor da próxima faixa: a primeira da paleta que ninguém está a usar.
 *
 * ⚠️ ERA `pistas.length % 6`, e isso repetia. Basta apagar uma faixa do meio para o contador
 * voltar a um número já ocupado — foi assim que duas faixas da mesma gravação ficaram as duas
 * roxas. Contar quantas há não diz nada sobre QUAIS cores estão em uso.
 *
 * Esgotadas as seis, volta a repetir — mas pela contagem, para as repetições ficarem espalhadas
 * em vez de caírem todas na primeira cor.
 */
export const proximaCorDaPista = (usadas: (number | null | undefined)[]): number => {
  const ocupadas = new Set(
    usadas.filter((c): c is number => typeof c === 'number')
      .map((c) => ((c % CORES_DA_PALETA) + CORES_DA_PALETA) % CORES_DA_PALETA),
  );
  for (let i = 0; i < CORES_DA_PALETA; i += 1) if (!ocupadas.has(i)) return i;
  return usadas.length % CORES_DA_PALETA;
};

export const proximaPosicaoDaPista = (posicoes: number[]): number =>
  posicoes.reduce((maior, p) => Math.max(maior, Number(p) || 0), -1) + 1;

/** Como se chama uma faixa que nasce vazia, antes de alguém lhe pôr um nome. */
export const PREFIXO_DA_PISTA = 'Faixa';

/**
 * O nome de uma faixa nova: o primeiro `Faixa N` que ainda não está em uso.
 *
 * ⚠️ O PRIMEIRO LIVRE, e não o total mais um. Com quatro faixas e a segunda apagada, "total +
 * 1" dava `Faixa 4` — que já existia — e a coluna ficava com duas faixas do mesmo nome, que é
 * a forma mais barata de alguém calar a errada.
 *
 * Só conta os nomes automáticos: quem baptizou uma faixa de "Voz" não fica a dever um número.
 */
export const nomeDaPistaNova = (nomes: string[]): string => {
  const usados = new Set(nomes
    .map((nome) => new RegExp(`^${PREFIXO_DA_PISTA} (\\d+)$`).exec(nome.trim())?.[1])
    .filter((n): n is string => !!n)
    .map(Number));
  let n = 1;
  while (usados.has(n)) n += 1;
  return `${PREFIXO_DA_PISTA} ${n}`;
};

const porPosicao = <T extends { position?: number; created_at?: string }>(a: T, b: T) =>
  (a.position ?? 0) - (b.position ?? 0)
  || String(a.created_at ?? '').localeCompare(String(b.created_at ?? ''));

/** As faixas da gravação, na ordem em que a tela as empilha. */
export const pistasDaGravacao = (versao?: CatalogVersion | null): CatalogTrack[] =>
  (versao?.tracks ?? []).slice().sort(porPosicao);

/**
 * A montagem que a mesa toca.
 *
 * ⚠️ SEM MONTAGEM, A MIX ENTRA SOZINHA. Toda gravação que já existe hoje tem um `audio_file` e
 * nenhuma pista — e tem de continuar a tocar ao abrir, sem ninguém montar nada. Ela vira uma
 * pista com um clipe só, do segundo zero ao fim. Assim que a primeira pista de verdade é
 * criada, a mix sai de cena: ela é a SOMA das camadas, e tocá-la junto faria cada instrumento
 * soar duas vezes.
 */
export const montagemDaVersao = (versao?: CatalogVersion | null): Pista[] => {
  if (!versao) return [];

  const faixas = pistasDaGravacao(versao);
  if (faixas.length) {
    const porId = new Map((versao.files ?? []).map((f: CatalogVersionFile) => [f.id, f]));
    return faixas.map((faixa) => ({
      id: faixa.id,
      nome: faixa.name,
      ganhoInicial: faixa.gain ?? 1,
      mudaInicial: faixa.muted ?? false,
      panInicial: Number(faixa.pan) || 0,
      // A cor guardada. `?? undefined` e não `?? indice`: quem desenha é que sabe qual é a
      // posição dela na lista, e é lá que o recurso da falta faz sentido.
      cor: faixa.color_index ?? undefined,
      clipes: (faixa.clips ?? [])
        .map((clipe): Clipe | null => {
          const arquivo = porId.get(clipe.file_id);
          const url = clipe.file_url ?? arquivo?.file_url;
          if (!url) return null;
          // O nome sai do FICHEIRO, e não do clipe: cortar um clipe em dois faz duas linhas
          // novas em `catalog_clips` que continuam a tocar o mesmo ficheiro, e as duas metades
          // têm de continuar a dizer de onde vieram.
          const bruto = clipe.file_name ?? arquivo?.name ?? '';
          return {
            id: clipe.id,
            url,
            nome: bruto ? tituloDoArquivo(bruto) : undefined,
            inicio: Number(clipe.start_seconds) || 0,
            recorte: Number(clipe.offset_seconds) || 0,
            duracao: Number(clipe.duration_seconds) || 0,
          };
        })
        // Um clipe sem ficheiro é uma linha órfã do banco: some da mesa em vez de a derrubar.
        .filter((c): c is Clipe => c !== null && c.duracao > 0)
        .sort((a, b) => a.inicio - b.inicio),
    }));
  }

  if (!versao.audio_file) return [];
  return [{
    id: ID_DA_MIX,
    nome: NOME_DA_MIX,
    clipes: [{
      id: `${ID_DA_MIX}:${versao.id}`,
      url: versao.audio_file,
      inicio: 0,
      recorte: 0,
      // A duração real chega com o buffer; até lá, um número grande o bastante para o clipe
      // não ser cortado. A mesa nunca toca além do fim do ficheiro — o contexto trata disso.
      duracao: DURACAO_DESCONHECIDA,
    }],
  }];
};

/**
 * Quanto dura um clipe cuja duração ainda não se sabe.
 *
 * Uma hora: mais do que qualquer gravação que passe por aqui, e o contexto simplesmente pára a
 * fonte no fim do buffer. O contrário — chutar baixo — cortaria a música no meio.
 */
export const DURACAO_DESCONHECIDA = 3600;
