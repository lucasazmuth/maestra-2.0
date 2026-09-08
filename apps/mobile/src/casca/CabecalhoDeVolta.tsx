import { useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import Feather from '@expo/vector-icons/Feather';

import { COR, COR_PERFIS } from '@maestra/core/constants/design';

import { BotaoDoMenuDoSistema, BotaoRedondo } from '@/casca/marca/MenuDoSistema';

// O cabeçalho das telas FOLHA do sistema — Configurações e Notificações.
//
// O botão de voltar no mesmo círculo branco do sino: é o controle que a plataforma já tem, e
// usá-lo aqui é o que faz estas telas parecerem parte do mesmo app.
//
// Elas já tiveram a barra completa da marca, e antes disso um "‹ Perfis" em texto solto. A
// barra completa dizia coisas que estas telas não precisam dizer: quem chegou aqui veio de um
// lugar e quer voltar para ele. O sino numa tela DE notificações é ruído.
//
// O menu do sistema é a exceção, e entra só onde `aqui` for dito. Ele já foi descartado destas
// telas inteiras com o argumento de que repetir o menu que abriu a tela em que se está é ruído,
// e o argumento era bom — mas vale para Notificações, não para Configurações. Na web o menu
// está nas duas, e em Configurações ele é o que dá a volta para outro perfil sem passar pela
// lista. Sem ele, `aqui: 'configuracoes'` era um estado que o app nunca alcançava: o item nunca
// aparecia aceso em lugar nenhum.

export const CabecalhoDeVolta = ({ para = '/perfis', aqui }: {
  para?: string;
  /** A tela em que se está. Dito só quando ela deve mostrar o menu do sistema. */
  aqui?: 'configuracoes';
}) => {
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

      {/* Voltar à esquerda, menu à direita: é onde os dois já ficam no cabeçalho do artista e
          na lista de perfis, e o painel abre ancorado no canto direito. */}
      {aqui && <View style={estilos.vao} />}
      {aqui && <BotaoDoMenuDoSistema aqui={aqui} />}
    </View>
  );
};

const estilos = StyleSheet.create({
  barra: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 18, paddingTop: 8, paddingBottom: 20,
    backgroundColor: COR.fundo,
  },
  vao: { flex: 1 },
});
