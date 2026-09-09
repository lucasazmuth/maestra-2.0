import { LIMITE_DA_PISTA_BYTES, MAXIMO_DE_PISTAS } from '../constants/maestra';
import type { CatalogVersionFile } from '../interfaces/maestra';
import { addVersionFile } from '../services/db/catalog';
import {
  BALDE_DO_CATALOGO, enviarArquivo, tipoDoCatalogo, tituloDoArquivo,
} from '../services/armazenamento';

// Mandar stems para uma gravação, vários de uma vez.
//
// Stems chegam em lote — quem exporta de uma DAW exporta as seis pistas juntas —, e um seletor
// de um ficheiro de cada vez transforma isso em seis viagens. Daí o `multiple` no seletor e
// esta fila aqui.

export interface ArquivoParaEnviar {
  nome: string;
  tipo?: string;
  tamanho?: number;
  /**
   * Os bytes, PREGUIÇOSAMENTE.
   *
   * É uma função e não os bytes porque no app cada leitura carrega o ficheiro inteiro na
   * memória: seis WAV de 40 MB lidos de uma vez são 240 MB antes de a primeira subida acabar.
   * Assim lê-se um de cada vez, no momento em que ele vai subir.
   */
  dados: () => Promise<ArrayBuffer | Blob>;
}

export type EstadoDoEnvio = 'na-fila' | 'enviando' | 'pronta' | 'erro';

export interface EnvioDePista {
  nome: string;
  estado: EstadoDoEnvio;
  erro?: string;
  pista?: CatalogVersionFile;
}

export interface Recusa { nome: string; motivo: string }

/** Quantas subidas ao mesmo tempo. Duas: seis em paralelo estrangulam-se numa rede fraca. */
const EM_PARALELO = 2;

/**
 * O que entra e o que não entra, ANTES de gastar rede.
 *
 * Pura de propósito: é a regra que a tela mostra e que o teste morde sem tocar em nada.
 */
export const validarPistas = <T extends { nome: string; tamanho?: number }>(
  arquivos: T[],
  jaExistem: number,
): { aceites: T[]; recusados: Recusa[] } => {
  // Genérica para devolver os PRÓPRIOS objetos que entraram: quem chama tem um arquivo do
  // aparelho (com a URI para ler os bytes) e precisa de o receber de volta inteiro. Filtrar
  // pelo nome do lado de fora falharia com dois ficheiros com o mesmo nome.
  const aceites: T[] = [];
  const recusados: Recusa[] = [];

  for (const arquivo of arquivos) {
    if (!tipoDoCatalogo(arquivo.nome)) {
      recusados.push({ nome: arquivo.nome, motivo: 'formato não aceito — use MP3 ou WAV' });
      continue;
    }
    if (arquivo.tamanho && arquivo.tamanho > LIMITE_DA_PISTA_BYTES) {
      const mb = Math.round(LIMITE_DA_PISTA_BYTES / (1024 * 1024));
      recusados.push({ nome: arquivo.nome, motivo: `maior que ${mb} MB` });
      continue;
    }
    // A contagem inclui o que já foi aceito nesta leva: mandar seis de uma vez com quatro já
    // no banco tem de recusar as duas últimas, e não aceitar as seis.
    if (jaExistem + aceites.length >= MAXIMO_DE_PISTAS) {
      recusados.push({ nome: arquivo.nome, motivo: `o limite é ${MAXIMO_DE_PISTAS} pistas` });
      continue;
    }
    aceites.push(arquivo);
  }

  return { aceites, recusados };
};

/**
 * Sobe as pistas e grava cada uma assim que chega.
 *
 * Gravar de imediato, e não no fim: uma falha a meio do lote deixa no banco as que subiram, e
 * quem está a olhar vê exatamente quais faltaram em vez de perder tudo e recomeçar.
 */
export const enviarPistas = async (p: {
  artistaId: string;
  projetoId: string;
  versaoId: string;
  arquivos: ArquivoParaEnviar[];
  jaExistem: number;
  aoMudar?: (envios: EnvioDePista[]) => void;
}): Promise<EnvioDePista[]> => {
  const envios: EnvioDePista[] = p.arquivos.map((a) => ({ nome: a.nome, estado: 'na-fila' }));
  const avisar = () => p.aoMudar?.(envios.map((e) => ({ ...e })));
  avisar();

  const pasta = `${p.artistaId}/${p.projetoId}/versions/${p.versaoId}/stems`;
  let proximo = 0;

  const trabalhar = async () => {
    for (;;) {
      const i = proximo;
      proximo += 1;
      if (i >= p.arquivos.length) return;

      const arquivo = p.arquivos[i];
      envios[i].estado = 'enviando';
      avisar();
      try {
        const dados = await arquivo.dados();
        const enviado = await enviarArquivo(BALDE_DO_CATALOGO, pasta, {
          nome: arquivo.nome, tipo: arquivo.tipo, dados,
        });
        envios[i].pista = await addVersionFile({
          version_id: p.versaoId,
          name: tituloDoArquivo(arquivo.nome),
          file_url: enviado.url,
          file_type: arquivo.tipo ?? null,
          kind: 'stem',
          // A posição é a da fila, depois do que já lá está: a ordem em que a pessoa escolheu
          // os ficheiros é a ordem em que ela espera vê-los.
          position: p.jaExistem + i,
          size_bytes: arquivo.tamanho ?? null,
        });
        envios[i].estado = 'pronta';
      } catch (e) {
        envios[i].estado = 'erro';
        envios[i].erro = e instanceof Error ? e.message : 'Não consegui enviar.';
      }
      avisar();
    }
  };

  await Promise.all(
    Array.from({ length: Math.min(EM_PARALELO, p.arquivos.length) }, trabalhar),
  );
  return envios;
};
