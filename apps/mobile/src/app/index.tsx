import { Redirect } from 'expo-router';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { COR, RAIO } from '@maestra/core/constants/design';
import { useSessao } from '@/nucleo/sessao';

// Porta de entrada: decide entre login e app.
//
// Enquanto nao se sabe, nao se redireciona. Mandar para o login e voltar meio segundo depois
// e o piscar que denuncia app mal feito — e a sessao quase sempre ESTA no disco.
export default function Porta() {
  const { sessao, carregando } = useSessao();

  if (carregando) {
    return (
      <View style={estilos.espera}>
        <ActivityIndicator color={COR.primaria} size="large" />
      </View>
    );
  }

  return <Redirect href={sessao ? '/perfis' : '/entrar'} />;
}

const estilos = StyleSheet.create({
  espera: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: COR.superficie },
});
