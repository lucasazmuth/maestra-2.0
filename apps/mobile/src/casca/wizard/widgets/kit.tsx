import { useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import Feather from '@expo/vector-icons/Feather';

import { WZ } from '@/casca/wizard/cores';

// O kit dos widgets do wizard: o cartão, o título, a pílula de opção, o campo "Outro" e os
// botões. É o `.nyta-card`, o `.wiz-option-pill` e o `primaryBtn` da web, medida por medida.
//
// A pílula carrega o indicador de seleção à esquerda: QUADRADO quando a escolha é múltipla,
// REDONDO quando é única — é a mesma regra da folha, e é o que diz, antes do toque, se dá para
// marcar mais de um.

export const Cartao = ({ titulo, children }: { titulo?: string; children: ReactNode }) => (
  <View style={estilos.cartao}>
    {!!titulo && <Text style={estilos.titulo}>{titulo}</Text>}
    {children}
  </View>
);

export const Acoes = ({ children }: { children: ReactNode }) => (
  <View style={estilos.acoes}>{children}</View>
);

export const BotaoPrincipal = ({
  rotulo, aoTocar, apagado, pequeno,
}: { rotulo: string; aoTocar: () => void; apagado?: boolean; pequeno?: boolean }) => (
  <Pressable
    style={[estilos.principal, pequeno && estilos.principalPequeno, apagado && estilos.apagado]}
    onPress={() => { if (!apagado) aoTocar(); }}
    accessibilityRole="button"
    accessibilityState={{ disabled: !!apagado }}
    accessibilityLabel={rotulo}
  >
    <Text style={[estilos.principalTexto, pequeno && estilos.principalTextoPequeno]}>{rotulo}</Text>
  </Pressable>
);

export const BotaoFantasma = ({ rotulo, aoTocar }: { rotulo: string; aoTocar: () => void }) => (
  <Pressable
    style={estilos.fantasma}
    onPress={aoTocar}
    accessibilityRole="button"
    accessibilityLabel={rotulo}
  >
    <Text style={estilos.fantasmaTexto}>{rotulo}</Text>
  </Pressable>
);

export const Pilula = ({
  rotulo, marcada, unica, aoTocar,
}: { rotulo: string; marcada?: boolean; unica?: boolean; aoTocar: () => void }) => (
  <Pressable
    style={[estilos.pilula, marcada && estilos.pilulaMarcada]}
    onPress={aoTocar}
    accessibilityRole={unica ? 'radio' : 'checkbox'}
    accessibilityState={{ checked: !!marcada }}
    accessibilityLabel={rotulo}
  >
    <View style={[
      estilos.caixa,
      unica && estilos.caixaRedonda,
      marcada && estilos.caixaMarcada,
    ]}>
      {marcada && (unica
        ? <View style={estilos.ponto} />
        : <Feather name="check" size={11} color={WZ.surface} />)}
    </View>
    <Text style={[estilos.pilulaTexto, marcada && estilos.pilulaTextoMarcado]}>{rotulo}</Text>
  </Pressable>
);

/** "Outro": é AÇÃO (abre o campo), não uma opção — por isso sem caixa de marcação. */
export const PilulaDeOutro = ({ aoTocar }: { aoTocar: () => void }) => (
  <Pressable
    style={[estilos.pilula, estilos.pilulaDeOutro]}
    onPress={aoTocar}
    accessibilityRole="button"
    accessibilityLabel="Outro"
  >
    <Feather name="edit-3" size={14} color={WZ.muted} />
    <Text style={[estilos.pilulaTexto, estilos.textoDeOutro]}>Outro</Text>
  </Pressable>
);

export const CampoDeOutro = ({
  espacoReservado, rotuloDoBotao = 'Usar', aoUsar,
}: { espacoReservado: string; rotuloDoBotao?: string; aoUsar: (texto: string) => void }) => {
  const [texto, setTexto] = useState('');
  return (
    <View style={estilos.linhaDoCampo}>
      <TextInput
        style={estilos.campo}
        value={texto}
        onChangeText={setTexto}
        placeholder={espacoReservado}
        placeholderTextColor={WZ.faint}
        onSubmitEditing={() => { if (texto.trim()) aoUsar(texto.trim()); }}
        accessibilityLabel={espacoReservado}
        autoFocus
      />
      <BotaoPrincipal
        rotulo={rotuloDoBotao}
        pequeno
        apagado={!texto.trim()}
        aoTocar={() => aoUsar(texto.trim())}
      />
    </View>
  );
};

export const Contagem = ({ n, singular, plural }: { n: number; singular: string; plural: string }) => (
  <Text style={estilos.contagem}>{n} {n === 1 ? singular : plural}</Text>
);

export const estilosDoKit = StyleSheet.create({
  grade: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
});

const estilos = StyleSheet.create({
  cartao: {
    padding: 16, borderRadius: 12,
    borderWidth: 1, borderColor: WZ.line, backgroundColor: WZ.surface,
    shadowColor: 'rgb(124, 145, 185)', shadowOpacity: 0.07, shadowRadius: 17,
    shadowOffset: { width: 0, height: 7 }, elevation: 2,
  },
  titulo: { fontSize: 14, fontWeight: '800', color: WZ.ink, marginBottom: 12 },
  acoes: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8, marginTop: 14 },

  principal: {
    paddingVertical: 10, paddingHorizontal: 22, borderRadius: 9999,
    borderWidth: 1, borderColor: WZ.blue, backgroundColor: WZ.blue,
    shadowColor: 'rgb(51, 97, 255)', shadowOpacity: 0.18, shadowRadius: 16,
    shadowOffset: { width: 0, height: 7 }, elevation: 3,
  },
  principalPequeno: { paddingVertical: 8, paddingHorizontal: 16 },
  // Apagado apaga TAMBÉM a borda e a sombra: só o fundo cinza deixava um botão contornado de
  // azul, com halo — parecia ativo mal pintado.
  apagado: {
    backgroundColor: WZ.line2, borderColor: WZ.line2, shadowOpacity: 0, elevation: 0,
  },
  principalTexto: { fontSize: 13, fontWeight: '800', color: WZ.surface },
  principalTextoPequeno: { fontSize: 13 },

  fantasma: {
    paddingVertical: 10, paddingHorizontal: 22, borderRadius: 9999,
    borderWidth: 1, borderColor: WZ.line2, backgroundColor: WZ.surface,
  },
  fantasmaTexto: { fontSize: 13, fontWeight: '800', color: WZ.text },

  pilula: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingVertical: 9, paddingHorizontal: 16, borderRadius: 9999,
    borderWidth: 1, borderColor: WZ.line2, backgroundColor: WZ.surface,
  },
  pilulaMarcada: {
    borderColor: WZ.blue, backgroundColor: WZ.blue,
    shadowColor: 'rgb(51, 97, 255)', shadowOpacity: 0.18, shadowRadius: 16,
    shadowOffset: { width: 0, height: 7 }, elevation: 3,
  },
  pilulaTexto: { fontSize: 13, fontWeight: '600', color: WZ.text },
  pilulaTextoMarcado: { fontWeight: '700', color: WZ.surface },
  pilulaDeOutro: { borderStyle: 'dashed', borderColor: WZ.faint, backgroundColor: 'transparent' },
  textoDeOutro: { color: WZ.muted },

  caixa: {
    width: 16, height: 16, borderRadius: 5, borderWidth: 2, borderColor: WZ.faint,
    alignItems: 'center', justifyContent: 'center',
  },
  caixaRedonda: { borderRadius: 8 },
  caixaMarcada: { borderColor: WZ.surface },
  ponto: { width: 8, height: 8, borderRadius: 4, backgroundColor: WZ.surface },

  linhaDoCampo: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 12 },
  campo: {
    flex: 1, minWidth: 0, paddingVertical: 12, paddingHorizontal: 20, borderRadius: 9999,
    borderWidth: 1, borderColor: WZ.line2, backgroundColor: WZ.surface,
    fontSize: 14, fontWeight: '600', color: WZ.ink,
  },
  contagem: { fontSize: 13, color: WZ.muted, alignSelf: 'center' },
});
