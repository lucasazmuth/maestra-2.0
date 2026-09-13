import { StyleSheet, Text, TextInput } from 'react-native';

import { AZUL_DO_EDITOR, COR_EDITOR } from '@maestra/core/constants/design';
import { soOAndamento, soOTom } from '@maestra/core/utils/camposDaGravacao';

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
  valor, aoMudar, sufixo, largura, numerico, maiusculas, limite, travado, rotulo,
}: {
  valor: string;
  aoMudar: (v: string) => void;
  /**
   * O que o campo mostra vazio: "BPM", "TOM".
   *
   * ⚠️ ERA UM RÓTULO AO LADO, e um traço dentro. Um campo vazio ao lado da palavra "BPM" é um
   * retângulo com um traço que não se lê como campo — a pessoa via a palavra e não percebia que
   * havia ali onde escrever. Como vazio, ele diz as duas coisas de uma vez: o que é, e que está
   * por preencher.
   */
  sufixo: string;
  largura: number;
  /** Só algarismos. Sem isto, o campo aceita o que o teclado do aparelho resolver oferecer. */
  numerico?: boolean;
  maiusculas?: boolean;
  limite: number;
  travado?: boolean;
  /** O que o leitor de ecrã anuncia. O sufixo sozinho não diz o que se está a editar. */
  rotulo: string;
}) => (
  <TextInput
    style={[
      estilos.campo,
      { width: largura },
      travado && estilos.campoTravado,
    ]}
    value={valor}
    // ⚠️ O FILTRO É AQUI, e não no teclado. O `keyboardType` é uma sugestão: há teclados que
    // trazem símbolos ao lado dos números, e colar de outro sítio passa por cima de qualquer
    // teclado. As duas regras vêm do núcleo, as mesmas que a web usa.
    onChangeText={(v) => aoMudar(numerico ? soOAndamento(v) : soOTom(v))}
    editable={!travado}
    placeholder={sufixo.toUpperCase()}
    placeholderTextColor={COR_EDITOR.rotulo}
    keyboardType={numerico ? 'number-pad' : 'default'}
    autoCapitalize={maiusculas ? 'characters' : 'none'}
    autoCorrect={false}
    maxLength={limite}
    accessibilityLabel={rotulo}
    // Sem `returnKeyType` o teclado numérico do iOS não traz tecla de fechar; "concluído"
    // é o que fecha um campo que não submete nada.
    returnKeyType="done"
  />
);

// ⚠️ AS MEDIDAS SÃO AS DA WEB, à letra: campo de 26 de altura com canto de 6. A pílula
// arredondada que estava aqui vinha do app claro, onde ela é da família do chip de status — e o
// status saiu desta tela. Redonda e larga no meio de uma barra de 44, ela era a única coisa do
// editor que não parecia do editor.
//
// O rótulo que ficava FORA do campo mudou-se para dentro, como vazio, nas duas superfícies.
const estilos = StyleSheet.create({
  campo: {
    height: 26, paddingHorizontal: 8, borderRadius: 6,
    // Zero de recuo vertical: o `TextInput` do Android traz o seu, e com ele o texto assenta
    // abaixo do centro do campo.
    paddingVertical: 0,
    borderWidth: 1, borderColor: COR_EDITOR.fio, backgroundColor: COR_EDITOR.acaoFundo,
    fontSize: 12, fontWeight: '700', textAlign: 'center', color: COR_EDITOR.titulo,
    // Tabular para o campo não mudar de largura entre 98 e 128 BPM.
    fontVariant: ['tabular-nums'],
  },
  campoTravado: { opacity: 0.5 },
});

/** O rótulo que diz de quem são os números. Uma linha para o par, e não uma por chip. */
export const DonoDosCampos = ({ texto, alerta }: { texto: string; alerta?: boolean }) => (
  <Text style={[estilos2.dono, alerta && estilos2.alerta]}>{texto}</Text>
);

const estilos2 = StyleSheet.create({
  dono: { marginTop: 4, paddingLeft: 54, fontSize: 11, fontWeight: '600', color: COR_EDITOR.rotulo },
  alerta: { color: AZUL_DO_EDITOR },
});
