import { useState } from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';

import Feather from '@expo/vector-icons/Feather';

import { COR_CHECKOUT, RAIO } from '@maestra/core/constants/design';

import { Escolha } from '@/casca/Escolha';

// Em quantas vezes.
//
// Na web é um `Select` do Ant Design; aqui é o campo mais uma folha com a lista, porque no
// celular um menu suspenso preso ao campo fica embaixo do teclado. O desenho da lista é o do
// `checkout-installments-dropdown`: linhas de 42px, a escolhida em azul-claro.
//
// O teto de parcelas não é um número fixo: sai do preço dividido pelo mínimo que a Asaas aceita
// por parcela (`parcelasPossiveis`, no núcleo). Oferecer 12x num preço baixo faria a cobrança
// voltar 400.
//
// A folha da lista era escrita AQUI, com véu, cantos e "check" próprios, igual à do plano e com
// medidas ligeiramente diferentes. Agora as duas são a mesma `casca/Escolha`.

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

      <Escolha
        aberta={aberto}
        titulo="Em quantas vezes"
        opcoes={opcoes.map((n) => ({ valor: String(n), rotulo: rotuloDa(n) }))}
        valor={String(valor)}
        aoEscolher={(v) => { if (v) aoEscolher(Number(v)); }}
        aoFechar={() => setAberto(false)}
      />
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
});
