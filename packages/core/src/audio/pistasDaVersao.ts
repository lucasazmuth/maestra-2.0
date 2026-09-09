import type { CatalogTrack, CatalogVersion, CatalogVersionFile } from '../interfaces/maestra';
import type { Clipe, Pista } from './mesa';

// A montagem de uma gravação, traduzida para o que a mesa toca.
//
// O banco guarda três coisas: os FICHEIROS enviados (`catalog_version_files`), as PISTAS da
// linha do tempo (`catalog_tracks`) e os CLIPES dentro delas (`catalog_clips`). A mesa só quer
// saber de pistas e clipes com URL, início, recorte e duração — esta camada faz a ponte, e é
// aqui que se resolve a única junção que o banco não traz pronta: clipe → ficheiro → URL.

/** O nome da pista da mix, quando a gravação ainda não foi montada em pistas. */
export const NOME_DA_MIX = 'Mix ★';
/** O id da pista que a mix ocupa. Não existe no banco: é montada na hora. */
export const ID_DA_MIX = 'mix';

export const ehPistaDaMix = (id: string): boolean => id === ID_DA_MIX;

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
      clipes: (faixa.clips ?? [])
        .map((clipe): Clipe | null => {
          const url = clipe.file_url ?? porId.get(clipe.file_id)?.file_url;
          if (!url) return null;
          return {
            id: clipe.id,
            url,
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
