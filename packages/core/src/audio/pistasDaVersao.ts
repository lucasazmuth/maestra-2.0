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
 * Em que lugar entra uma faixa nova: depois da última.
 *
 * ⚠️ A PRÓXIMA POSIÇÃO, e não a CONTAGEM das faixas. As duas dão o mesmo número enquanto as
 * posições forem 0, 1, 2… — e deixam de dar assim que uma gravação antiga tem a primeira faixa
 * em 1, ou assim que alguém apaga uma do meio. Aí a faixa nova nasce empatada com uma que já
 * existe, e a ordem da coluna passa a ser decidida pelo desempate da data de criação: duas
 * telas, dois momentos, duas ordens possíveis para a mesma montagem.
 */
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
