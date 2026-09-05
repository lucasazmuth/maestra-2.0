import type { ReactNode } from 'react';
import {
  ActivityIndicator, StyleSheet, Text, TextInput, View, type KeyboardTypeOptions,
} from 'react-native';

import Feather from '@expo/vector-icons/Feather';

import { COR, COR_CHECKOUT, RAIO } from '@maestra/core/constants/design';

// Um campo do checkout: rótulo em maiúsculas, caixa com ícone à esquerda e, embaixo, o erro ou
// a dica.
//
// O contorno é mais forte aqui do que no resto do app (1,5px em `#aebfda`, contra o `#e1e7f0`
// dos outros campos) e não é engano: é o bloco `.light .field` da folha do checkout. Numa tela
// onde se digita cartão, o campo tem de parecer campo.

type Props = {
  rotulo: string;
  icone: keyof typeof Feather.glyphMap;
  valor: string;
  aoMudar: (v: string) => void;
  espacoReservado?: string;
  erro?: string;
  dica?: string;
  teclado?: KeyboardTypeOptions;
  maiusculas?: boolean;
  maximo?: number;
  carregando?: boolean;
  aoEnviar?: () => void;
  sufixo?: ReactNode;
};

export const Campo = ({
  rotulo, icone, valor, aoMudar, espacoReservado, erro, dica, teclado, maiusculas,
  maximo, carregando, aoEnviar, sufixo,
}: Props) => (
  <View style={estilos.campo}>
    <Text style={estilos.rotulo}>{rotulo}</Text>
    <View style={[estilos.caixa, !!erro && estilos.caixaComErro]}>
      <Feather name={icone} size={16} color={COR_CHECKOUT.apoio} />
      <TextInput
        style={estilos.entrada}
        value={valor}
        onChangeText={aoMudar}
        placeholder={espacoReservado}
        placeholderTextColor={COR_CHECKOUT.espacoReservado}
        keyboardType={teclado}
        autoCapitalize={maiusculas ? 'characters' : 'none'}
        autoCorrect={false}
        maxLength={maximo}
        onSubmitEditing={aoEnviar}
        accessibilityLabel={rotulo}
      />
      {carregando && <ActivityIndicator size="small" color={COR.primaria} />}
      {sufixo}
    </View>
    {!!erro && <Text style={estilos.erro}>{erro}</Text>}
    {!erro && !!dica && <Text style={estilos.dica}>{dica}</Text>}
  </View>
);

const estilos = StyleSheet.create({
  campo: { minWidth: 0 },
  rotulo: {
    fontSize: 12, letterSpacing: 0.36, textTransform: 'uppercase',
    color: COR_CHECKOUT.rotulo, marginBottom: 6,
  },
  caixa: {
    flexDirection: 'row', alignItems: 'center', gap: 11,
    minHeight: 46, paddingHorizontal: 15, borderRadius: RAIO.campoDeEntrada,
    borderWidth: 1.5, borderColor: COR_CHECKOUT.campoContorno,
    backgroundColor: COR_CHECKOUT.campoFundo,
    shadowColor: 'rgb(51, 72, 110)', shadowOpacity: 0.05, shadowRadius: 3,
    shadowOffset: { width: 0, height: 1 }, elevation: 1,
  },
  caixaComErro: { borderColor: COR_CHECKOUT.erroIcone },
  entrada: { flex: 1, fontSize: 15, color: COR_CHECKOUT.titulo, paddingVertical: 12 },
  erro: { fontSize: 12, color: COR_CHECKOUT.erro, marginTop: 5 },
  dica: { fontSize: 12, color: COR_CHECKOUT.apoio, marginTop: 5 },
});
