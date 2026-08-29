import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import Feather from '@expo/vector-icons/Feather';

import { COR, COR_NYTA, RAIO } from '@maestra/core/constants/design';
import {
  buildActionSummary, formatArgValue, HIDDEN_ARG_KEYS, translateArgLabel, translateToolName,
} from '@maestra/core/nucleo/acoesDaNyta';
import type { PendingToolCall } from '@maestra/core/store/slices/nytaChat';

// O cartão de confirmação de ação.
//
// A Nyta pode criar, alterar e remover coisas no perfil, e nunca faz nada sem passar por aqui.
// O texto deste cartão É o consentimento: por isso ele não fala em `create_catalog_item` nem
// mostra UUID nenhum — as tabelas de tradução vivem no núcleo e são as MESMAS da web.

export const CartaoDeAcao = ({ acao, aoConfirmar, aoCancelar }: {
  acao: PendingToolCall;
  aoConfirmar: (id: string) => void;
  aoCancelar: (id: string) => void;
}) => {
  const campos = Object.entries(acao.arguments).filter(([chave]) => !HIDDEN_ARG_KEYS.has(chave));
  const decidindo = acao.status === 'pending' || acao.status === 'error';

  return (
    <View style={estilos.cartao}>
      <View style={estilos.cabecalho}>
        <Text style={estilos.rotulo}>Ação:</Text>
        <Text style={estilos.nome}>{translateToolName(acao.name)}</Text>
      </View>

      <Text style={estilos.resumo}>{buildActionSummary(acao.name, acao.arguments)}</Text>

      {campos.length > 0 && (
        <View style={estilos.campos}>
          {campos.map(([chave, valor]) => (
            <View key={chave} style={estilos.campo}>
              <Text style={estilos.campoRotulo}>{translateArgLabel(chave)}:</Text>
              {Array.isArray(valor) ? (
                <View style={estilos.flex}>
                  {(valor as unknown[]).map((item, i) => (
                    // eslint-disable-next-line react/no-array-index-key
                    <Text key={i} style={estilos.campoValor}>· {formatArgValue(item)}</Text>
                  ))}
                </View>
              ) : (
                <Text style={estilos.campoValor}>{formatArgValue(valor, chave)}</Text>
              )}
            </View>
          ))}
        </View>
      )}

      {acao.status === 'executing' && (
        <View style={estilos.estado}>
          <ActivityIndicator size="small" color={COR.primaria} />
          <Text style={estilos.estadoTexto}>Executando…</Text>
        </View>
      )}
      {(acao.status === 'confirmed' || acao.status === 'done') && (
        <View style={estilos.estado}>
          <Feather name="check" size={14} color={COR_NYTA.textoDoArtista} />
          <Text style={estilos.estadoTexto}>Ação executada</Text>
        </View>
      )}
      {acao.status === 'cancelled' && (
        <View style={estilos.estado}>
          <Text style={estilos.estadoTexto}>Ação cancelada</Text>
        </View>
      )}

      {decidindo && (
        <View style={estilos.botoes}>
          <Pressable
            style={[estilos.botao, estilos.confirmar]}
            onPress={() => aoConfirmar(acao.toolCallId)}
            accessibilityRole="button"
            accessibilityLabel="Confirmar ação"
          >
            <Feather name="check" size={14} color={COR.sobrePrimaria} />
            <Text style={estilos.confirmarTexto}>Confirmar</Text>
          </Pressable>
          <Pressable
            style={[estilos.botao, estilos.cancelar]}
            onPress={() => aoCancelar(acao.toolCallId)}
            accessibilityRole="button"
            accessibilityLabel="Cancelar ação"
          >
            <Feather name="x" size={14} color={COR_NYTA.bolhaTexto} />
            <Text style={estilos.cancelarTexto}>Cancelar</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
};

const estilos = StyleSheet.create({
  cartao: {
    marginBottom: 18,
    padding: 14,
    gap: 10,
    borderRadius: RAIO.cartao,
    borderWidth: 1,
    borderColor: COR_NYTA.bolhaContorno,
    backgroundColor: COR_NYTA.bolha,
  },
  flex: { flex: 1 },
  cabecalho: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  rotulo: { color: COR_NYTA.limiteTexto, fontSize: 11, fontWeight: '700' },
  nome: { flex: 1, color: COR.titulo, fontSize: 13, fontWeight: '800' },
  resumo: { color: COR_NYTA.bolhaTexto, fontSize: 13, lineHeight: 20 },
  campos: { gap: 6, paddingTop: 4 },
  campo: { flexDirection: 'row', gap: 6 },
  campoRotulo: { color: COR_NYTA.limiteTexto, fontSize: 12, fontWeight: '700' },
  campoValor: { flex: 1, color: COR_NYTA.bolhaTexto, fontSize: 12, lineHeight: 18 },
  estado: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  estadoTexto: { color: COR_NYTA.limiteTexto, fontSize: 12, fontWeight: '700' },
  botoes: { flexDirection: 'row', gap: 8 },
  botao: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 11,
    borderRadius: RAIO.campoDeEntrada,
  },
  confirmar: { backgroundColor: COR.primaria },
  confirmarTexto: { color: COR.sobrePrimaria, fontSize: 13, fontWeight: '800' },
  cancelar: { borderWidth: 1, borderColor: COR_NYTA.campoContorno, backgroundColor: COR_NYTA.bolha },
  cancelarTexto: { color: COR_NYTA.bolhaTexto, fontSize: 13, fontWeight: '700' },
});
