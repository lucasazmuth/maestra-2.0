import type { ReactNode } from 'react';
import { ActivityIndicator, Image, Pressable, StyleSheet, Text, View } from 'react-native';

import Feather from '@expo/vector-icons/Feather';

import { RECEBEDOR } from '@maestra/core/constants/checkout';
import { COR, COR_CHECKOUT, RAIO } from '@maestra/core/constants/design';

// "Seu carrinho": o que está sendo comprado, o que vem junto, os totais e o botão de pagar.
//
// Na web ele é a coluna da direita, colada no topo enquanto a página rola. No celular a grade
// colapsa em uma coluna e ele vem DEPOIS do formulário — que é o que o app faz, já que rolar é
// a única leitura possível aqui.

type Linha = { rotulo: string; valor: string; forte?: boolean };

type Props = {
  titulo?: string;
  topo?: ReactNode;
  item: { imagem?: string | null; nome: string; apoio?: string; preco: string };
  inclui?: readonly string[];
  linhas?: Linha[];
  legal?: ReactNode;
  rotuloDoBotao: string;
  aoPagar: () => void;
  carregando?: boolean;
  motivoDoBloqueio?: string;
  erro?: string;
};

export const Carrinho = ({
  titulo = 'Seu carrinho', topo, item, inclui, linhas, legal, rotuloDoBotao, aoPagar,
  carregando, motivoDoBloqueio, erro,
}: Props) => (
  <View style={estilos.carrinho}>
    <Text style={estilos.titulo}>{titulo}</Text>

    {topo}

    <View style={estilos.item}>
      {item.imagem
        ? <Image source={{ uri: item.imagem }} style={estilos.itemImagem} />
        : (
          <View style={[estilos.itemImagem, estilos.itemSemImagem]}>
            <Feather name="user" size={20} color={COR.primaria} />
          </View>
        )}
      <View style={estilos.itemMeio}>
        <Text style={estilos.itemNome}>{item.nome}</Text>
        {!!item.apoio && <Text style={estilos.itemApoio}>{item.apoio}</Text>}
      </View>
      <Text style={estilos.itemPreco}>{item.preco}</Text>
    </View>

    {!!inclui?.length && (
      <View style={estilos.inclui}>
        {inclui.map((linha) => (
          <View key={linha} style={estilos.incluiItem}>
            <View style={estilos.incluiDisco}>
              <Feather name="check" size={11} color={COR.primaria} />
            </View>
            <Text style={estilos.incluiTexto}>{linha}</Text>
          </View>
        ))}
      </View>
    )}

    {linhas?.map((linha) => (
      <View key={linha.rotulo} style={estilos.linha}>
        <Text style={[estilos.linhaTexto, linha.forte && estilos.linhaForte]}>{linha.rotulo}</Text>
        <Text style={[estilos.linhaTexto, linha.forte && estilos.linhaForte]}>{linha.valor}</Text>
      </View>
    ))}

    {!!legal && <View style={estilos.legal}>{legal}</View>}

    {!!erro && (
      <View style={estilos.erro} accessibilityRole="alert">
        <Feather name="alert-circle" size={15} color={COR_CHECKOUT.erroIcone} />
        <Text style={estilos.erroTexto}>{erro}</Text>
      </View>
    )}

    {/* O botão continua TOCÁVEL quando falta preencher algo: o toque valida e mostra o erro no
        campo. Bloqueado de verdade, ele deixaria a pessoa sem saber o que falta — e o que
        costuma faltar é o CPF no PIX. */}
    <Pressable
      style={[estilos.pagar, (!!motivoDoBloqueio || carregando) && estilos.pagarApagado]}
      onPress={() => { if (!carregando) aoPagar(); }}
      accessibilityRole="button"
      accessibilityState={{ disabled: !!carregando }}
      accessibilityLabel={motivoDoBloqueio ? `${rotuloDoBotao}. ${motivoDoBloqueio}` : rotuloDoBotao}
    >
      {carregando
        ? (
          <>
            <ActivityIndicator size="small" color={COR.sobrePrimaria} />
            <Text style={estilos.pagarTexto}>Processando…</Text>
          </>
        )
        : <Text style={estilos.pagarTexto}>{rotuloDoBotao}</Text>}
    </Pressable>

    <View style={estilos.seguro}>
      <Feather name="lock" size={12} color={COR_CHECKOUT.seguro} />
      <Text style={estilos.seguroTexto}>Compra segura · processada via Asaas</Text>
    </View>

    <Text style={estilos.recebedor}>
      Na fatura do cartão e no extrato, a cobrança aparece como{'\n'}
      <Text style={estilos.recebedorNome}>{RECEBEDOR.razaoSocial}</Text> · CNPJ {RECEBEDOR.cnpj}
    </Text>
  </View>
);

const estilos = StyleSheet.create({
  carrinho: {
    padding: 22, borderRadius: 16, borderWidth: 1, borderColor: COR_CHECKOUT.contorno,
    backgroundColor: COR.superficie,
    shadowColor: 'rgb(51, 72, 110)', shadowOpacity: 0.06, shadowRadius: 26,
    shadowOffset: { width: 0, height: 10 }, elevation: 2,
  },
  titulo: { fontSize: 20, fontWeight: '800', color: COR_CHECKOUT.titulo, marginBottom: 16 },

  item: { flexDirection: 'row', alignItems: 'center', gap: 13, paddingTop: 4, paddingBottom: 16 },
  itemImagem: { width: 46, height: 46, borderRadius: 11 },
  itemSemImagem: {
    alignItems: 'center', justifyContent: 'center', backgroundColor: COR_CHECKOUT.disco,
  },
  itemMeio: { flex: 1, minWidth: 0 },
  itemNome: { fontSize: 15, fontWeight: '700', lineHeight: 18.75, color: COR_CHECKOUT.titulo },
  itemApoio: { fontSize: 12.5, fontWeight: '600', color: COR.primaria, marginTop: 2 },
  itemPreco: {
    fontSize: 14, fontWeight: '700', color: COR_CHECKOUT.titulo, alignSelf: 'flex-start',
  },

  inclui: {
    gap: 9, paddingVertical: 14, marginBottom: 4,
    borderTopWidth: 1, borderTopColor: COR_CHECKOUT.fio,
  },
  incluiItem: { flexDirection: 'row', alignItems: 'flex-start', gap: 9 },
  incluiDisco: {
    width: 18, height: 18, borderRadius: 9, marginTop: 1,
    alignItems: 'center', justifyContent: 'center', backgroundColor: COR_CHECKOUT.disco,
  },
  incluiTexto: { flex: 1, fontSize: 13, lineHeight: 18.2, color: COR_CHECKOUT.texto },

  linha: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: 12, borderTopWidth: 1, borderTopColor: COR_CHECKOUT.fio,
  },
  linhaTexto: { fontSize: 14, color: COR_CHECKOUT.texto },
  linhaForte: { fontWeight: '800', color: COR_CHECKOUT.titulo },

  legal: { marginBottom: 16 },

  erro: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 8,
    marginTop: 6, marginBottom: 16, padding: 11, paddingHorizontal: 13,
    borderRadius: RAIO.campoDeEntrada, borderWidth: 1, borderColor: COR_CHECKOUT.erroContorno,
    backgroundColor: COR_CHECKOUT.erroFundo,
  },
  erroTexto: { flex: 1, fontSize: 13, lineHeight: 18.85, color: COR_CHECKOUT.erro },

  pagar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    paddingVertical: 15, paddingHorizontal: 24, borderRadius: 12,
    backgroundColor: COR.primaria,
    shadowColor: 'rgb(51, 97, 255)', shadowOpacity: 0.2, shadowRadius: 20,
    shadowOffset: { width: 0, height: 10 }, elevation: 4,
  },
  pagarApagado: { opacity: 0.55 },
  pagarTexto: { fontSize: 16, fontWeight: '800', color: COR.sobrePrimaria },

  seguro: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, marginTop: 12,
  },
  seguroTexto: { fontSize: 12.5, color: COR_CHECKOUT.seguro },
  recebedor: {
    marginTop: 8, fontSize: 11.5, lineHeight: 17.25, textAlign: 'center',
    color: COR_CHECKOUT.seguro,
  },
  recebedorNome: { fontWeight: '700', color: COR_CHECKOUT.titulo },
});
