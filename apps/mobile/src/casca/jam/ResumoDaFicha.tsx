import { Pressable, StyleSheet, Text } from 'react-native';

import Feather from '@expo/vector-icons/Feather';

import { COR, COR_JAM } from '@maestra/core/constants/design';
import { fichaVazia, resumoDaFicha, type DadosDaFicha } from '@maestra/core/utils/resumoDaFicha';

// A ficha técnica numa LINHA, no lugar da grelha 2×2.
//
// A grelha custava 153 pt — o bloco mais alto do Espaço JAM — e quase sempre mostrava quatro
// traços. Metade do ecrã passava antes da primeira versão, que é o assunto da tela. Esta linha
// ocupa o que tem para dizer, e quando não tem nada, convida.
//
// Tocar abre a MESMA ficha que o lápis abre: é lá que BPM, tom, gênero e data se editam. Um
// segundo formulário só para estes quatro faria parecer outra entidade.

export const ResumoDaFicha = ({ dados, aoTocar }: { dados: DadosDaFicha; aoTocar: () => void }) => {
  const vazia = fichaVazia(dados);
  return (
    <Pressable
      style={estilos.linha}
      onPress={aoTocar}
      accessibilityRole="button"
      accessibilityLabel={vazia ? 'Adicionar BPM, tom e gênero' : 'Editar a ficha técnica'}
    >
      <Text style={[estilos.texto, vazia && estilos.convite]} numberOfLines={1}>
        {resumoDaFicha(dados)}
      </Text>
      <Feather name="chevron-right" size={16} color={vazia ? COR.primaria : COR_JAM.rotulo} />
    </Pressable>
  );
};

const estilos = StyleSheet.create({
  linha: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingVertical: 10,
  },
  texto: { flex: 1, fontSize: 14, fontWeight: '600', color: COR_JAM.texto },
  // O convite é uma ação, e veste-se como uma: a cor primária, que é a dos links do app.
  convite: { fontWeight: '700', color: COR.primaria },
});
