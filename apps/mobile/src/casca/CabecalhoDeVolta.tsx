import { useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import Feather from '@expo/vector-icons/Feather';

import { COR, COR_PERFIS } from '@maestra/core/constants/design';

import { BotaoRedondo } from '@/casca/marca/MenuDoSistema';

// O cabeçalho das telas FOLHA do sistema — Configurações e Notificações.
//
// Um botão só, o de voltar, no mesmo círculo branco do sino: é o controle que a plataforma já
// tem, e usá-lo aqui é o que faz estas telas parecerem parte do mesmo app.
//
// Elas já tiveram a barra completa da marca, e antes disso um "‹ Perfis" em texto solto. A
// barra completa dizia coisas que estas telas não precisam dizer: quem chegou aqui veio de um
// lugar e quer voltar para ele. O sino numa tela DE notificações e o menu que abriu a própria
// tela em que se está são ruído.

export const CabecalhoDeVolta = ({ para = '/perfis' }: { para?: string }) => {
  const router = useRouter();

  // `back` quando há para onde voltar, e o destino declarado quando não há — é o caso de quem
  // abre a tela por link direto, com a pilha vazia.
  const voltar = () => {
    if (router.canGoBack()) router.back();
    else router.replace(para as never);
  };

  return (
    <View style={estilos.barra}>
      <BotaoRedondo rotulo="Voltar" aoTocar={voltar}>
        <Feather name="chevron-left" size={24} color={COR_PERFIS.menu} />
      </BotaoRedondo>
    </View>
  );
};

const estilos = StyleSheet.create({
  barra: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 18, paddingTop: 8, paddingBottom: 20,
    backgroundColor: COR.fundo,
  },
});
