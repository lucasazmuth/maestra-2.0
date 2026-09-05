import { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import Feather from '@expo/vector-icons/Feather';

import { COR, COR_CHECKOUT, RAIO } from '@maestra/core/constants/design';

// Em quantas vezes.
//
// Na web é um `Select` do Ant Design; aqui é o campo mais uma folha com a lista, porque no
// celular um menu suspenso preso ao campo fica embaixo do teclado. O desenho da lista é o do
// `checkout-installments-dropdown`: linhas de 42px, a escolhida em azul-claro.
//
// O teto de parcelas não é um número fixo: sai do preço dividido pelo mínimo que a Asaas aceita
// por parcela (`parcelasPossiveis`, no núcleo). Oferecer 12x num preço baixo faria a cobrança
// voltar 400.

type Props = {
  valor: number;
  maximo: number;
  aoEscolher: (n: number) => void;
  rotuloDa: (n: number) => string;
};

export const Parcelas = ({ valor, maximo, aoEscolher, rotuloDa }: Props) => {
  const [aberto, setAberto] = useState(false);
  const opcoes = Array.from({ length: maximo }, (_, i) => i + 1);

  return (
    <>
      <Pressable
        style={estilos.campo}
        onPress={() => setAberto(true)}
        accessibilityRole="button"
        accessibilityLabel={`Parcelamento: ${rotuloDa(valor)}`}
      >
        <Text style={estilos.valor} numberOfLines={1}>{rotuloDa(valor)}</Text>
        <Feather name="chevron-down" size={16} color={COR_CHECKOUT.apoio} />
      </Pressable>

      <Modal visible={aberto} transparent animationType="fade" onRequestClose={() => setAberto(false)}>
        <Pressable style={estilos.vidro} onPress={() => setAberto(false)}>
          <Pressable style={estilos.folha} onPress={(e) => e.stopPropagation()}>
            <Text style={estilos.titulo}>Em quantas vezes</Text>
            <ScrollView>
              {opcoes.map((n) => {
                const escolhida = n === valor;
                return (
                  <Pressable
                    key={n}
                    style={[estilos.opcao, escolhida && estilos.opcaoEscolhida]}
                    onPress={() => { aoEscolher(n); setAberto(false); }}
                    accessibilityRole="button"
                    accessibilityState={{ selected: escolhida }}
                    accessibilityLabel={rotuloDa(n)}
                  >
                    <Text style={[estilos.opcaoTexto, escolhida && estilos.opcaoTextoEscolhida]}>
                      {rotuloDa(n)}
                    </Text>
                    {escolhida && <Feather name="check" size={15} color={COR.primaria} />}
                  </Pressable>
                );
              })}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
};

const estilos = StyleSheet.create({
  campo: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10,
    minHeight: 50, paddingHorizontal: 15, borderRadius: RAIO.campoDeEntrada,
    borderWidth: 1.5, borderColor: COR_CHECKOUT.campoContorno,
    backgroundColor: COR_CHECKOUT.campoFundo,
  },
  valor: { flex: 1, fontSize: 14, fontWeight: '600', color: COR_CHECKOUT.titulo },
  vidro: {
    flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(38, 54, 82, .24)',
  },
  folha: {
    maxHeight: '70%', padding: 6, paddingBottom: 28,
    borderTopLeftRadius: 18, borderTopRightRadius: 18,
    borderWidth: 1, borderColor: COR_CHECKOUT.campoContorno, backgroundColor: COR.superficie,
  },
  titulo: {
    fontSize: 13, fontWeight: '700', color: COR_CHECKOUT.apoio,
    paddingHorizontal: 12, paddingTop: 12, paddingBottom: 8,
  },
  opcao: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    minHeight: 42, paddingHorizontal: 12, borderRadius: 7,
  },
  opcaoEscolhida: { backgroundColor: COR_CHECKOUT.disco },
  opcaoTexto: { fontSize: 14, fontWeight: '600', color: COR_CHECKOUT.titulo },
  opcaoTextoEscolhida: { color: COR_CHECKOUT.escolhidoTexto },
});
