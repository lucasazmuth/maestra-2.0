import { useState, type ReactNode } from 'react';
import { Modal, Pressable, StyleSheet, Text } from 'react-native';

import Feather from '@expo/vector-icons/Feather';

import { COR_EDITOR } from '@maestra/core/constants/design';

// Um botão redondo que abre um balão POR CIMA da tela — a letra e a ajuda do editor.
//
// ⚠️ SÃO BALÕES, e não abas. Escreve-se letra a olhar para a montagem, e uma aba faria trocar de
// tela para ler um verso; a ajuda, idem. É o que a web faz com dois `<details>` flutuantes.
//
// ⚠️ E ABREM PARA CIMA: eles moram encostados ao rodapé, e para baixo não há tela. No app o
// balão é um `Modal`, porque uma `View` absoluta dentro do editor seria cortada pelo corpo que
// a contém — e um balão cortado é pior do que nenhum.

export const BalaoFlutuante = ({ icone, rotulo, largura, bottom, right, children }: {
  /** O desenho do botão. Uma letra (o "?") ou um ícone. */
  icone: keyof typeof Feather.glyphMap | '?';
  rotulo: string;
  /** A largura do balão. A letra pede mais do que a ajuda. */
  largura: number;
  bottom: number;
  right: number;
  children: ReactNode;
}) => {
  const [aberto, setAberto] = useState(false);

  return (
    <>
      <Pressable
        onPress={() => setAberto(true)}
        style={[estilos.redondo, { bottom, right }]}
        accessibilityRole="button"
        accessibilityLabel={rotulo}
      >
        {icone === '?'
          ? <Text style={estilos.interrogacao}>?</Text>
          : <Feather name={icone} size={14} color={COR_EDITOR.acaoIcone} />}
      </Pressable>

      <Modal visible={aberto} transparent animationType="fade" onRequestClose={() => setAberto(false)}>
        {/* Tocar fora fecha: é o gesto que todo balão tem, e sem ele o único caminho de volta
            seria um X que ocuparia o lugar do conteúdo. */}
        <Pressable style={estilos.fundo} onPress={() => setAberto(false)}>
          <Pressable
            style={[estilos.balao, { width: largura, bottom: bottom + 44, right: Math.max(12, right - largura / 2) }]}
            // Um toque DENTRO do balão não o fecha.
            onPress={() => {}}
          >
            {children}
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
};

const estilos = StyleSheet.create({
  redondo: {
    position: 'absolute',
    width: 34, height: 34, borderRadius: 17,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: COR_EDITOR.cabecaDaVersao,
    borderWidth: 1, borderColor: COR_EDITOR.fio,
  },
  interrogacao: { fontSize: 15, fontWeight: '700', color: COR_EDITOR.acaoIcone },

  fundo: { flex: 1, backgroundColor: 'rgba(0, 0, 0, .45)' },
  balao: {
    position: 'absolute',
    maxHeight: '70%',
    padding: 14, borderRadius: 8,
    backgroundColor: COR_EDITOR.painel,
    borderWidth: 1, borderColor: COR_EDITOR.vazioContorno,
  },
});
