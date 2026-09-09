import type { CatalogVersion, CatalogVersionFile } from '../interfaces/maestra';
import type { Pista } from './mesa';

// Que pistas a mesa carrega para uma gravação.
//
// Uma gravação (versão) tem sempre a sua MIX — o `audio_file`, que é o que o catálogo toca e o
// que o certificado assina — e pode ter STEMS, as camadas dela.
//
// ⚠️ A MIX ENTRA MUDA QUANDO HÁ STEMS, e é a decisão menos óbvia deste arquivo. A mix já é a
// soma das camadas: tocá-la junto com elas faz cada instrumento soar duas vezes, ligeiramente
// desalinhado (a mix passou por processamento que os stems não têm), o que soa a defeito. Muda,
// ela continua ali para quem quiser SOLAR e comparar "como ficou" com "o que está por baixo" —
// que é exatamente o gesto que um editor de stems tem de permitir.

/** O nome da pista da mix. A estrela liga-a visualmente à gravação principal. */
export const NOME_DA_MIX = 'Mix ★';

const ehStem = (f: CatalogVersionFile) => f.kind === 'stem';

/**
 * Os stems de uma gravação, na ordem em que a mesa os mostra.
 *
 * `position` primeiro, `created_at` como desempate: duas pistas com a mesma posição (um envio
 * em lote que gravou tudo com 0, por exemplo) ficam na ordem em que chegaram, e não numa ordem
 * que muda a cada leitura.
 */
export const stemsDaVersao = (versao?: CatalogVersion | null): CatalogVersionFile[] =>
  (versao?.files ?? [])
    .filter(ehStem)
    .slice()
    .sort((a, b) => (a.position ?? 0) - (b.position ?? 0)
      || String(a.created_at ?? '').localeCompare(String(b.created_at ?? '')));

/**
 * As pistas da mesa: a mix mais os stems.
 *
 * Sem stems, a mix entra sozinha e ACESA — a mesa com uma pista é o tocador da gravação, e é o
 * que toda versão que já existe hoje passa a ter, sem ninguém enviar nada.
 */
export const pistasDaVersao = (versao?: CatalogVersion | null): Pista[] => {
  if (!versao) return [];
  const stems = stemsDaVersao(versao);
  const pistas: Pista[] = [];

  if (versao.audio_file) {
    pistas.push({
      id: `mix:${versao.id}`,
      nome: NOME_DA_MIX,
      url: versao.audio_file,
      mudaInicial: stems.length > 0,
    });
  }

  for (const stem of stems) {
    pistas.push({
      id: stem.id,
      nome: stem.name,
      url: stem.file_url,
      ganhoInicial: stem.gain ?? 1,
    });
  }

  return pistas;
};

/** É a pista da mix? A tela trata-a à parte: não se renomeia, não se apaga, não se reordena. */
export const ehPistaDaMix = (id: string): boolean => id.startsWith('mix:');
