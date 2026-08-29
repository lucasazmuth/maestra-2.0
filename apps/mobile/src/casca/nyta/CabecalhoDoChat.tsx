import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';

import Feather from '@expo/vector-icons/Feather';

import { COR_CONVERSAS, COR_NYTA, RAIO } from '@maestra/core/constants/design';
import type { Artist } from '@maestra/core/interfaces/maestra';

import { EmblemaNyta } from '@/casca/EmblemaNyta';
import { FotoDoArtista } from '@/casca/FotoDoArtista';

// O cabeçalho da conversa — a porta de `src/pages/NytaChat/components/ChatHeader.tsx`.
//
// Quem fala aqui é a Nyta, então é o nome DELA que titula; o artista vira contexto ao lado.
// Antes o título era só o nome do artista, o que fazia a tela parecer a página do perfil.
//
// O "voltar" leva às CONVERSAS, e não ao perfil. No celular a lista não cabe ao lado e vira o
// nível de trás desta tela: voltar leva à lista, e é de lá que se sai da Nyta. É a navegação em
// dois níveis de qualquer aplicativo de mensagem, e é o que a web faz abaixo de 900px.

export const CabecalhoDoChat = ({
  artista, usadas, limite, aoAbrirConversas, aoLimpar,
}: {
  artista?: Artist;
  usadas?: number | null;
  limite?: number | null;
  aoAbrirConversas: () => void;
  aoLimpar: () => void;
}) => {
  // O contador só chega depois da primeira resposta do dia; sem ele o selo não entra.
  const mostrarUso = typeof usadas === 'number' && typeof limite === 'number';
  const noLimite = mostrarUso && usadas >= limite;

  const confirmarLimpeza = () => {
    Alert.alert(
      'Limpar conversa?',
      'Todas as mensagens serão apagadas. Esta ação não pode ser desfeita.',
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Limpar', style: 'destructive', onPress: aoLimpar },
      ],
    );
  };

  return (
    <View style={estilos.cabecalho}>
      <Pressable
        style={estilos.redondo}
        onPress={aoAbrirConversas}
        accessibilityRole="button"
        accessibilityLabel="Voltar para as conversas"
      >
        <Feather name="arrow-left" size={17} color={COR_CONVERSAS.botao} />
      </Pressable>

      <View style={estilos.identidade}>
        <EmblemaNyta size={30} />
        <Text style={estilos.titulo}>Nyta IA</Text>

        {/* De quem é esta conversa. O nome solto embaixo do título parecia legenda; com a foto e
            o "sobre", vê-se de imediato sobre qual perfil se está perguntando. */}
        {!!artista && (
          <View style={estilos.contexto}>
            <Text style={estilos.contextoRotulo}>sobre</Text>
            <FotoDoArtista artista={artista} tamanho={22} />
            <Text style={estilos.contextoNome} numberOfLines={1}>{artista.name}</Text>
          </View>
        )}
      </View>

      <View style={estilos.acoes}>
        {mostrarUso && (
          <View style={[estilos.uso, noLimite && estilos.usoCheio]}>
            <Text
              style={[estilos.usoTexto, noLimite && estilos.usoCheioTexto]}
              accessibilityLabel={`${usadas} de ${limite} mensagens usadas hoje`}
            >
              {usadas}/{limite}
            </Text>
          </View>
        )}

        <Pressable
          style={estilos.limpar}
          onPress={confirmarLimpeza}
          accessibilityRole="button"
          accessibilityLabel="Limpar conversa"
        >
          <Feather name="trash-2" size={16} color={COR_CONVERSAS.rotulo} />
        </Pressable>
      </View>
    </View>
  );
};

const estilos = StyleSheet.create({
  cabecalho: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minHeight: 70,
    paddingHorizontal: 18,
    borderBottomWidth: 1,
    borderBottomColor: COR_CONVERSAS.fio,
    backgroundColor: COR_NYTA.bolha,
  },
  redondo: {
    width: 34,
    height: 34,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: RAIO.pilula,
    borderWidth: 1,
    borderColor: COR_CONVERSAS.contorno,
    backgroundColor: COR_NYTA.bolha,
  },
  identidade: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 11, minWidth: 0 },
  titulo: { color: COR_CONVERSAS.titulo, fontSize: 14, fontWeight: '800', lineHeight: 18 },
  contexto: {
    flexShrink: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingVertical: 4,
    paddingLeft: 5,
    paddingRight: 11,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: COR_CONVERSAS.contorno,
    backgroundColor: COR_CONVERSAS.contexto,
  },
  contextoRotulo: { color: COR_CONVERSAS.rotulo, fontSize: 10, fontWeight: '700' },
  contextoNome: { flexShrink: 1, color: COR_CONVERSAS.titulo, fontSize: 12, fontWeight: '700' },
  acoes: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  uso: { paddingVertical: 4, paddingHorizontal: 9, borderRadius: 20, backgroundColor: COR_CONVERSAS.destaque },
  usoCheio: { backgroundColor: COR_CONVERSAS.usoCheioFundo },
  usoTexto: { color: COR_CONVERSAS.uso, fontSize: 11, fontWeight: '800' },
  usoCheioTexto: { color: COR_CONVERSAS.usoCheioTexto },
  limpar: {
    width: 34,
    height: 34,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: RAIO.pilula,
  },
});
