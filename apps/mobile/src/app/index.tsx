import { Redirect } from 'expo-router';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { COR, RAIO } from '@maestra/core/constants/design';
import { useSessao } from '@/nucleo/sessao';

// Porta de entrada: decide entre a apresentacao, o login e o app.
//
// Enquanto nao se sabe, nao se redireciona. Mandar para o login e voltar meio segundo depois
// e o piscar que denuncia app mal feito — e a sessao quase sempre ESTA no disco.
//
// Sem sessao, a apresentacao. SEMPRE, e nao uma vez por instalacao: abrir o app do zero e o
// momento em que se pergunta "o que e isto", e a resposta tem que estar la toda vez.
//
// Quem SAI da conta nao passa por aqui: o portao da sessao manda direto para o login (ver
// `nucleo/PortaoDaSessao`). Quem acabou de sair sabe o que o app faz, e receber boas-vindas
// depois de fechar a porta seria deboche.
export default function Porta() {
  const { sessao, carregando } = useSessao();

  if (carregando) {
    return (
      <View style={estilos.espera}>
        <ActivityIndicator color={COR.primaria} size="large" />
      </View>
    );
  }

  return <Redirect href={sessao ? '/perfis' : '/intro'} />;
}

const estilos = StyleSheet.create({
  espera: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: COR.superficie },
});
