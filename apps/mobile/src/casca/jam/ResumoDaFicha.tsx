import { Pressable, StyleSheet, Text } from 'react-native';

import Feather from '@expo/vector-icons/Feather';

import { AZUL_DO_EDITOR, COR_EDITOR } from '@maestra/core/constants/design';
import {
  CONVITE_DO_PROJETO, projetoVazio, resumoDoProjeto, type DadosDoProjeto,
} from '@maestra/core/utils/resumoDaFicha';

// O que é da MÚSICA, numa linha: o gênero e a data.
//
// Começou por ser a ficha inteira (BPM, tom, gênero, data) no lugar de uma grelha 2×2 de 153 pt.
// Depois o BPM e o tom subiram para o cabeçalho, editáveis em linha, porque são da GRAVAÇÃO e
// mudam de valor conforme a gravação aberta. O que sobra aqui é o que pertence à música e não
// muda de uma gravação para a outra — e é essa a divisão que a tela agora ensina sem dizer:
// em cima, a gravação; aqui, a música.
//
// Tocar abre a MESMA ficha que o lápis abre. Um segundo formulário só para dois campos faria
// parecer outra entidade.

export const ResumoDaFicha = ({ dados, aoTocar }: { dados: DadosDoProjeto; aoTocar: () => void }) => {
  const vazia = projetoVazio(dados);
  return (
    <Pressable
      style={estilos.linha}
      onPress={aoTocar}
      accessibilityRole="button"
      accessibilityLabel={vazia ? CONVITE_DO_PROJETO : 'Editar as informações da música'}
    >
      <Text style={[estilos.texto, vazia && estilos.convite]} numberOfLines={1}>
        {resumoDoProjeto(dados)}
      </Text>
      <Feather name="chevron-right" size={16} color={vazia ? AZUL_DO_EDITOR : COR_EDITOR.rotulo} />
    </Pressable>
  );
};

const estilos = StyleSheet.create({
  linha: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingVertical: 10,
  },
  texto: { flex: 1, fontSize: 14, fontWeight: '600', color: COR_EDITOR.texto },
  // O convite é uma ação, e veste-se como uma: a cor primária, que é a dos links do app.
  convite: { fontWeight: '700', color: AZUL_DO_EDITOR },
});
