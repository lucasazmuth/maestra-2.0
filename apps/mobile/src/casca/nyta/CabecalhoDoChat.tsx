import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import Feather from '@expo/vector-icons/Feather';

import { COR_CONVERSAS } from '@maestra/core/constants/design';
import type { Artist } from '@maestra/core/interfaces/maestra';

import { BotaoRedondo } from '@/casca/marca/MenuDoSistema';

// A faixa do chat.
//
// Ela tinha o emblema da Nyta, o título "Nyta IA", uma pílula "sobre <artista>" com foto, o uso
// do dia e uma lixeira. Seis coisas numa tela cuja função é ler e escrever. Sobraram três:
// sair, ver as conversas, começar outra — os mesmos três da web (`NytaChat/ChatHeader.tsx`).
//
// Nesta rota o `_layout.tsx` não renderiza o cabeçalho do artista nem a barra de abas, então
// esta é a ÚNICA faixa da tela: ela carrega a margem de cima do aparelho e precisa pesar o
// mínimo. Por isso o título saiu — a tela inteira já diz de quem é a voz.
//
// O nome do artista ficou, em texto solto no meio. A Nyta responde com os dados de UM perfil, e
// numa conta com vários não há como saber de qual sem isso.
//
// Tudo que É da conversa mora na LISTA, e não aqui: criar uma nova, renomear, excluir. Esta
// faixa só leva até lá. A lixeira e o "nova conversa" já moraram nela, e ter duas portas para a
// mesma ação não deixa nada mais rápido — só faz procurar em duas.

export const CabecalhoDoChat = ({ artista, aoSair, aoAbrirConversas }: {
  artista?: Artist;
  /** Sai do chat e volta ao perfil. */
  aoSair: () => void;
  aoAbrirConversas: () => void;
}) => {
  const margem = useSafeAreaInsets();

  return (
    <View style={[estilos.faixa, { paddingTop: margem.top + 6 }]}>
      <BotaoRedondo rotulo="Sair da conversa" aoTocar={aoSair}>
        <Feather name="arrow-left" size={20} color={COR_CONVERSAS.botao} />
      </BotaoRedondo>

      <Text style={estilos.escopo} numberOfLines={1}>{artista?.name ?? ''}</Text>

      <BotaoRedondo rotulo="Ver as conversas" aoTocar={aoAbrirConversas}>
        <Feather name="message-square" size={19} color={COR_CONVERSAS.botao} />
      </BotaoRedondo>
    </View>
  );
};

const estilos = StyleSheet.create({
  faixa: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 14, paddingBottom: 6,
  },
  escopo: {
    flex: 1, color: COR_CONVERSAS.botao, fontSize: 14, fontWeight: '700',
    textAlign: 'center',
  },
});
