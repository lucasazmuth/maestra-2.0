import { StyleSheet, Text, TextInput, View } from 'react-native';

import { AZUL_DO_EDITOR, COR_EDITOR } from '@maestra/core/constants/design';

// Um valor da gravação, editável ali mesmo no cabeçalho: o BPM, o tom.
//
// ─── Por que voltou para a tela ──────────────────────────────────────────────
//
// Estes dois campos já tinham vivido no cabeçalho e foram para dentro da ficha, porque a tela
// estava confusa. Mas o que confundia não era editar em linha — era não se saber DE QUEM era o
// número: da música ou da gravação? O dono do produto pediu-os de volta, e a correção não é
// esconder o campo, é dizer de quem ele é. Daí o `dono` por baixo dos dois ("da gravação
// principal ★"), escrito uma vez para o par e não repetido em cada chip.
//
// Sem gravação principal marcada, os campos ficam TRANCADOS em vez de sumirem: um BPM digitado
// sem saber onde ia parar era exatamente o problema antigo. O rótulo passa a dizer o que fazer.

export const CampoDoCabecalho = ({
  valor, aoMudar, sufixo, largura, numerico, maiusculas, limite, travado, rotulo, ouvido,
}: {
  valor: string;
  aoMudar: (v: string) => void;
  /** O que vem depois do campo: "BPM", "Tom". */
  sufixo: string;
  largura: number;
  numerico?: boolean;
  maiusculas?: boolean;
  limite: number;
  travado?: boolean;
  /** O que o leitor de ecrã anuncia. O sufixo sozinho não diz o que se está a editar. */
  rotulo: string;
  /**
   * Este número foi OUVIDO do áudio, e não escrito por alguém.
   *
   * ⚠️ A DIFERENÇA IMPORTA: um palpite da máquina, sem marca, é indistinguível de um número que
   * a pessoa escreveu e esqueceu — e é sobre esse que ela depois vai confiar para registar a
   * obra. A borda muda de cor e o leitor de tela diz de onde veio.
   */
  ouvido?: boolean;
}) => (
  <View style={[estilos.chip, travado && estilos.chipTravado, ouvido && estilos.chipOuvido]}>
    <TextInput
      style={[estilos.campo, { width: largura }]}
      value={valor}
      onChangeText={aoMudar}
      editable={!travado}
      placeholder="—"
      placeholderTextColor={COR_EDITOR.estrela}
      keyboardType={numerico ? 'number-pad' : 'default'}
      autoCapitalize={maiusculas ? 'characters' : 'none'}
      autoCorrect={false}
      maxLength={limite}
      accessibilityLabel={ouvido ? `${rotulo}, ouvido do áudio` : rotulo}
      // Sem `returnKeyType` o teclado numérico do iOS não traz tecla de fechar; "concluído"
      // é o que fecha um campo que não submete nada.
      returnKeyType="done"
    />
    <Text style={estilos.sufixo}>{sufixo}</Text>
  </View>
);

const estilos = StyleSheet.create({
  // Vestido de chip para ficar da mesma família do status ao lado — mas com contorno e fundo
  // claro, porque este ACEITA texto e aquele abre uma lista. Um campo pintado como o status
  // prometeria um menu.
  chip: {
    height: 28, paddingHorizontal: 10, borderRadius: 999,
    flexDirection: 'row', alignItems: 'center', gap: 4,
    // ⚠️ O FUNDO É O DO CAMPO, e não o `papel`. As duas coisas coincidem no app claro — um
    // campo branco numa tela branca — e separam-se no editor: ali `papel` é a tinta que se
    // escreve por cima de uma cor cheia, e continua branca. Usá-lo aqui punha duas pílulas
    // brancas a gritar no meio de uma tela quase preta.
    borderWidth: 1, borderColor: COR_EDITOR.fio, backgroundColor: COR_EDITOR.botaoRedondo,
  },
  chipOuvido: { borderColor: AZUL_DO_EDITOR },
  chipTravado: { backgroundColor: COR_EDITOR.acaoFundo, borderColor: COR_EDITOR.acaoFundo },
  campo: {
    // Zero de padding e altura cheia: o `TextInput` do Android traz recuo próprio e, com ele,
    // o texto assenta abaixo do centro do chip.
    padding: 0, height: 28,
    fontSize: 13, fontWeight: '800', color: COR_EDITOR.titulo,
    // Tabular para o chip não mudar de largura entre 98 e 128 BPM.
    fontVariant: ['tabular-nums'],
  },
  sufixo: { fontSize: 11, fontWeight: '700', color: COR_EDITOR.rotulo },
});

/** O rótulo que diz de quem são os números. Uma linha para o par, e não uma por chip. */
export const DonoDosCampos = ({ texto, alerta }: { texto: string; alerta?: boolean }) => (
  <Text style={[estilos2.dono, alerta && estilos2.alerta]}>{texto}</Text>
);

const estilos2 = StyleSheet.create({
  dono: { marginTop: 4, paddingLeft: 54, fontSize: 11, fontWeight: '600', color: COR_EDITOR.rotulo },
  alerta: { color: AZUL_DO_EDITOR },
});
