import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import Feather from '@expo/vector-icons/Feather';

import { COR, COR_CHECKOUT, RAIO } from '@maestra/core/constants/design';

// O campo de cupom — e também o de Pass Access.
//
// É UM campo só de propósito: quem tem um código na mão não sabe (nem precisa saber) se ele é
// um cupom de desconto ou um passe que libera o perfil inteiro. Quem decide é o servidor.

type Props = {
  valor: string;
  aoMudar: (v: string) => void;
  aoAplicar: () => void;
  aoLimpar: () => void;
  carregando?: boolean;
  erro?: string;
  aplicado?: string | null;
};

export const Cupom = ({
  valor, aoMudar, aoAplicar, aoLimpar, carregando, erro, aplicado,
}: Props) => (
  <View>
    <Text style={estilos.rotulo}>Cupom de desconto (opcional)</Text>

    {aplicado ? (
      <View style={estilos.aplicado}>
        <View style={estilos.aplicadoTexto}>
          <Feather name="tag" size={13} color={COR.primaria} />
          <Text style={estilos.aplicadoRotulo} numberOfLines={1}>{aplicado}</Text>
        </View>
        <Pressable
          style={estilos.remover}
          onPress={aoLimpar}
          accessibilityRole="button"
          accessibilityLabel="Remover cupom"
        >
          <Feather name="x" size={14} color={COR_CHECKOUT.apoio} />
          <Text style={estilos.removerTexto}>Remover</Text>
        </Pressable>
      </View>
    ) : (
      <View style={estilos.linha}>
        <View style={[estilos.caixa, !!erro && estilos.caixaComErro]}>
          <Feather name="tag" size={16} color={COR_CHECKOUT.apoio} />
          <TextInput
            style={estilos.entrada}
            value={valor}
            onChangeText={(v) => aoMudar(v.toUpperCase())}
            onSubmitEditing={aoAplicar}
            placeholder="Digite o código"
            placeholderTextColor={COR_CHECKOUT.espacoReservado}
            autoCapitalize="characters"
            autoCorrect={false}
            maxLength={30}
            accessibilityLabel="Cupom de desconto"
          />
        </View>
        <Pressable
          style={[estilos.botao, (!valor.trim() || carregando) && estilos.botaoApagado]}
          onPress={() => { if (valor.trim() && !carregando) aoAplicar(); }}
          accessibilityRole="button"
          accessibilityState={{ disabled: !valor.trim() || !!carregando }}
          accessibilityLabel="Aplicar cupom"
        >
          {carregando
            ? <ActivityIndicator size="small" color={COR_CHECKOUT.titulo} />
            : <Text style={estilos.botaoTexto}>Aplicar</Text>}
        </Pressable>
      </View>
    )}

    {!!erro && <Text style={estilos.erro}>{erro}</Text>}
  </View>
);

const estilos = StyleSheet.create({
  rotulo: {
    fontSize: 12, letterSpacing: 0.36, textTransform: 'uppercase',
    color: COR_CHECKOUT.rotulo, marginBottom: 6,
  },
  linha: { flexDirection: 'row', gap: 12, alignItems: 'stretch' },
  caixa: {
    flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 11,
    minHeight: 48, paddingHorizontal: 15, borderRadius: RAIO.campoDeEntrada,
    borderWidth: 1, borderColor: COR_CHECKOUT.campoContorno,
    backgroundColor: COR_CHECKOUT.campoFundo,
    shadowColor: 'rgb(51, 72, 110)', shadowOpacity: 0.06, shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 }, elevation: 1,
  },
  caixaComErro: { borderColor: COR_CHECKOUT.erroIcone },
  entrada: { flex: 1, fontSize: 15, color: COR_CHECKOUT.titulo },
  botao: {
    minWidth: 94, minHeight: 48, alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: 20, borderRadius: RAIO.campoDeEntrada,
    borderWidth: 1, borderColor: COR_CHECKOUT.cupomBotaoContorno,
    backgroundColor: COR_CHECKOUT.cupomFundo,
  },
  // Apagado é COR e não opacidade: a folha troca o fundo e a tinta em vez de esmaecer o botão.
  botaoApagado: { backgroundColor: COR_CHECKOUT.cupomApagado },
  botaoTexto: { fontSize: 14, fontWeight: '700', color: COR_CHECKOUT.titulo },
  aplicado: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10,
    paddingVertical: 11, paddingHorizontal: 12, borderRadius: RAIO.campoDeEntrada,
    borderWidth: 1, borderColor: COR_CHECKOUT.cupomAplicadoContorno,
    backgroundColor: COR_CHECKOUT.disco,
  },
  aplicadoTexto: { flexDirection: 'row', alignItems: 'center', gap: 7, flex: 1, minWidth: 0 },
  aplicadoRotulo: { fontSize: 13, fontWeight: '700', color: COR.primaria },
  remover: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  removerTexto: { fontSize: 12, color: COR_CHECKOUT.apoio },
  erro: { fontSize: 12, color: COR_CHECKOUT.erro, marginTop: 5 },
});
