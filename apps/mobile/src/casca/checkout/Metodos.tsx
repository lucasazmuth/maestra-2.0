import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { COR, COR_CHECKOUT, RAIO } from '@maestra/core/constants/design';

import AmexSvg from '@/assets/brand/cc-amex.svg';
import MastercardSvg from '@/assets/brand/cc-mastercard.svg';
import PixSvg from '@/assets/brand/pix-mark.svg';
import VisaSvg from '@/assets/brand/cc-visa.svg';

// A escolha do meio de pagamento: linhas com rádio que ABREM o conteúdo da opção escolhida —
// o formulário do cartão ou o aviso do PIX. É o mesmo desenho da web (padrão Adobe), e não um
// seletor de abas: a pessoa vê as duas opções e o que cada uma pede.
//
// As marcas são os MESMOS vetores da web: o PIX vem de `src/assets/pix-mark.svg` e as bandeiras
// do `react-icons/fa`, que não existe no React Native — foram gravadas como arquivo em
// `assets/brand`. `src/__tests__/copiaDasBandeiras.test.ts` prova que continuam iguais.

export type MeioDePagamento = 'PIX' | 'CREDIT' | 'DEBIT';

const MARCA = { width: 28, height: 28, color: COR_CHECKOUT.titulo };

const META: Record<MeioDePagamento, { rotulo: string; marcas: ReactNode }> = {
  PIX: { rotulo: 'PIX', marcas: <PixSvg width={26} height={26} /> },
  CREDIT: {
    rotulo: 'Cartão de crédito',
    marcas: <><VisaSvg {...MARCA} /><MastercardSvg {...MARCA} /><AmexSvg {...MARCA} /></>,
  },
  DEBIT: {
    rotulo: 'Cartão de débito',
    marcas: <><VisaSvg {...MARCA} /><MastercardSvg {...MARCA} /></>,
  },
};

type Props = {
  meios: MeioDePagamento[];
  escolhido: MeioDePagamento;
  aoEscolher: (m: MeioDePagamento) => void;
  corpo: (m: MeioDePagamento) => ReactNode;
};

export const Metodos = ({ meios, escolhido, aoEscolher, corpo }: Props) => (
  <View style={estilos.lista}>
    {meios.map((meio) => {
      const aceso = meio === escolhido;
      return (
        <View key={meio} style={[estilos.metodo, aceso && estilos.metodoAceso]}>
          <Pressable
            style={estilos.cabeca}
            onPress={() => aoEscolher(meio)}
            accessibilityRole="radio"
            accessibilityState={{ checked: aceso }}
            accessibilityLabel={META[meio].rotulo}
          >
            <View style={[estilos.radio, aceso && estilos.radioAceso]}>
              {aceso && <View style={estilos.radioMiolo} />}
            </View>
            <Text style={estilos.rotulo}>{META[meio].rotulo}</Text>
            <View style={estilos.marcas}>{META[meio].marcas}</View>
          </Pressable>
          {aceso && <View style={estilos.corpo}>{corpo(meio)}</View>}
        </View>
      );
    })}
  </View>
);

const estilos = StyleSheet.create({
  lista: { gap: 12 },
  metodo: {
    borderWidth: 1.5, borderColor: COR_CHECKOUT.metodoContorno, borderRadius: RAIO.cartao,
    overflow: 'hidden',
  },
  metodoAceso: { borderColor: COR.primaria, backgroundColor: COR_CHECKOUT.metodoEscolhidoFundo },
  cabeca: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 15, paddingHorizontal: 16 },
  radio: {
    width: 18, height: 18, borderRadius: 9, borderWidth: 2, borderColor: COR_CHECKOUT.metodoRadio,
    alignItems: 'center', justifyContent: 'center',
  },
  radioAceso: { borderColor: COR.primaria },
  radioMiolo: { width: 9, height: 9, borderRadius: 4.5, backgroundColor: COR.primaria },
  rotulo: { flex: 1, fontSize: 15, fontWeight: '700', color: COR_CHECKOUT.titulo },
  marcas: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  corpo: { paddingHorizontal: 16, paddingBottom: 18 },
});
