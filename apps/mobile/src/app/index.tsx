import { Redirect } from 'expo-router';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { COR, RAIO } from '@maestra/core/constants/design';
import { introJaVista } from '@/nucleo/intro';
import { useSessao } from '@/nucleo/sessao';

// Porta de entrada: decide entre a apresentacao, o login e o app.
//
// Enquanto nao se sabe, nao se redireciona. Mandar para o login e voltar meio segundo depois
// e o piscar que denuncia app mal feito — e a sessao quase sempre ESTA no disco.
//
// Sem sessao, quem NUNCA viu a apresentacao vai para ela; quem ja viu vai direto ao login. Uma
// vez por instalacao: repetir as boas-vindas a cada sessao expirada vira pedagio.
export default function Porta() {
  const { sessao, carregando } = useSessao();

  if (carregando) {
    return (
      <View style={estilos.espera}>
        <ActivityIndicator color={COR.primaria} size="large" />
      </View>
    );
  }

  if (sessao) return <Redirect href="/perfis" />;
  return <Redirect href={introJaVista() ? '/entrar' : '/intro'} />;
}

const estilos = StyleSheet.create({
  espera: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: COR.superficie },
});
