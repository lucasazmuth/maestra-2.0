import { createContext, useContext } from 'react';

import { AZUL_DO_EDITOR, COR, COR_CATALOGO, COR_EDITOR } from '@maestra/core/constants/design';

// A PALETA DAS FOLHAS — o equivalente, no app, do que a web faz com uma classe de CSS.
//
// O editor tem a ficha numa aba, e essa aba é escura. O formulário da ficha, porém, é o MESMO da
// lista de Músicas, que é clara — e um segundo formulário escuro com os mesmos campos seriam
// duas verdades sobre a mesma música, que divergem no primeiro ajuste.
//
// Na web isto resolve-se com uma classe (`.ficha`) que recolore o que está dentro dela. No app
// não há cascata: o que há é contexto. Quem monta a ficha dentro do editor embrulha-a na paleta
// escura, e os componentes da folha leem daqui em vez de lerem as constantes direto.
//
// ⚠️ AS CHAVES SÃO AS QUE A FOLHA USA, uma a uma. Uma cor que exista numa paleta e não na outra
// passa a ser erro de compilação, e não um buraco na tela.

export interface PaletaDaFolha {
  fundo: string;
  papel: string;
  titulo: string;
  texto: string;
  rotulo: string;
  legenda: string;
  espacoReservado: string;
  contorno: string;
  divisoria: string;
  primaria: string;
  destaque: string;
  erro: string;
  /** A tinta que se escreve POR CIMA da primária — o texto do botão cheio. */
  sobrePrimaria: string;
  /** O fundo das pílulas de apoio (sugestões, avatares vazios). */
  realce: string;
  realceTinta: string;
}

export const PALETA_CLARA: PaletaDaFolha = {
  fundo: COR.fundo,
  papel: '#ffffff',
  titulo: COR_CATALOGO.titulo,
  texto: COR.secundario,
  rotulo: COR_CATALOGO.rotulo,
  legenda: COR_CATALOGO.legenda,
  espacoReservado: COR.espaçoReservado,
  contorno: COR.contorno,
  divisoria: COR.divisoria,
  primaria: COR.primaria,
  destaque: COR.destaque,
  erro: COR.erro,
  sobrePrimaria: COR.sobrePrimaria,
  realce: COR_CATALOGO.tocarFundo,
  realceTinta: COR_CATALOGO.tocarIcone,
};

export const PALETA_ESCURA: PaletaDaFolha = {
  fundo: COR_EDITOR.fundoDe,
  papel: COR_EDITOR.painel,
  titulo: COR_EDITOR.titulo,
  texto: COR_EDITOR.texto,
  rotulo: COR_EDITOR.rotulo,
  legenda: COR_EDITOR.apoio,
  espacoReservado: COR_EDITOR.estrela,
  contorno: COR_EDITOR.fio,
  divisoria: COR_EDITOR.fio,
  primaria: AZUL_DO_EDITOR,
  destaque: COR_EDITOR.cabecaDaVersao,
  erro: COR.erro,
  // Branco sobre o azul da ação, nos dois lados: é a mesma tinta e a mesma leitura.
  sobrePrimaria: COR.sobrePrimaria,
  realce: COR_EDITOR.cabecaDaVersao,
  realceTinta: COR_EDITOR.apoio,
};

const Contexto = createContext<PaletaDaFolha>(PALETA_CLARA);

export const PaletaDaFolhaProvider = Contexto.Provider;

/** A paleta em vigor. Fora de qualquer editor, a clara — que é o app inteiro. */
export const usarPaleta = (): PaletaDaFolha => useContext(Contexto);
