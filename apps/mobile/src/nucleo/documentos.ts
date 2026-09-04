import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { File, Paths } from 'expo-file-system';

import {
  montarDocumentoDoDiagnostico, type DadosDoDocumento,
} from '@maestra/core/documentos/diagnosticoHtml';

// Gerar e entregar o PDF do diagnóstico, no aparelho.
//
// A web monta o deck em DOM, fotografa página por página e cola as fotos num PDF. Aqui o caminho
// é melhor: o `expo-print` imprime o MESMO documento a partir do HTML do núcleo, então o PDF sai
// com texto de verdade — selecionável, pesquisável e com um décimo do tamanho.
//
// O arquivo nasce com um nome temporário do sistema; renomeamos para o nome do artista antes de
// entregar, porque é esse nome que a pessoa vê ao salvar em Arquivos ou mandar no WhatsApp.

/** A folha A4, em pontos — a mesma medida que o HTML do núcleo desenha em pixels. */
const A4 = { largura: 595, altura: 842 } as const;

/** O nome do arquivo, no mesmo molde da web: `diagnostico-nome-do-artista.pdf`. */
export const nomeDoArquivo = (artista: string) =>
  `diagnostico-${(artista || 'artista').toLowerCase().trim().replace(/\s+/g, '-')}.pdf`;

/**
 * Gera o PDF e abre a folha de compartilhamento (salvar em Arquivos, mandar, imprimir).
 *
 * Não existe "baixar" no iOS: o equivalente é a folha do sistema, e é ela que leva o arquivo
 * para onde a pessoa quiser.
 */
export const baixarDiagnostico = async (dados: DadosDoDocumento): Promise<void> => {
  // O TAMANHO DA FOLHA vem daqui, não do `@page` do CSS: o WKWebView imprime no papel que a API
  // manda e ignora a regra da folha de estilo. Sem isto ele usa Carta (612×792pt), que é mais
  // BAIXA que o A4 — cada página do deck vazava para uma segunda, e o PDF saía com 24 páginas,
  // metade delas em branco.
  const { uri } = await Print.printToFileAsync({
    html: montarDocumentoDoDiagnostico(dados),
    width: A4.largura,
    height: A4.altura,
    base64: false,
  });

  const gerado = new File(uri);
  const destino = new File(Paths.cache, nomeDoArquivo(dados.artistName));
  if (destino.exists) destino.delete();
  gerado.move(destino);

  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(destino.uri, {
      mimeType: 'application/pdf',
      dialogTitle: 'Diagnóstico REAL',
      UTI: 'com.adobe.pdf',
    });
  }
};
