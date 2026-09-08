import { Tabs, useLocalSearchParams, usePathname } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { Cabecalho } from '@/casca/Cabecalho';
import { BarraDeAbas } from '@/casca/BarraDeAbas';
import { useArtistaDaRota } from '@/nucleo/artista';

// A casca do perfil: cabeçalho em cima, ilha de navegação embaixo, e as telas no meio.
//
// É `Tabs`, e não `Stack`, pela razão de sempre: numa pilha, tocar Plano → Músicas → Agenda
// empilha três telas, e o gesto de voltar do iOS desfaz a navegação numa ordem que ninguém
// pediu. Aba é aba — cada uma guarda o próprio estado e trocar não empilha nada.
//
// O artista é carregado UMA vez, aqui, e desce por prop pro cabeçalho e pra barra. As telas
// seguem chamando `useArtistaDaRota` por conta própria; é o mesmo seletor sobre o mesmo store,
// então não há busca repetida — e cada tela continua abrindo sozinha por deep link.
//
// O cabeçalho fica FORA do `Tabs`, e não em `screenOptions.header`: ali ele seria um componente
// POR ABA, e as cinco cópias assinavam o mesmo canal de realtime do sino — o Supabase recusa o
// segundo `.on()` num canal já inscrito, e a tela quebrava ao trocar de aba. Um cabeçalho só,
// acima das abas, é também o que a web faz.
//
// A Nyta é a exceção: ali as duas somem e o chat toma a tela. Uma conversa que se lê e se
// escreve não tem altura de sobra para duas barras que não falam dela, e a faixa do próprio
// chat passa a ser a única — com o botão de voltar como saída. A web faz o mesmo nessa rota
// (ver `isImmersiveRoute` em `src/components/Layout/components/MobileNav`).

export default function CascaDoArtista() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const artista = useArtistaDaRota(id);
  const caminho = usePathname();
  const imersivo = caminho.endsWith('/nyta');

  return (
    <View style={estilos.casca}>
      {!imersivo && <Cabecalho artista={artista} id={String(id)} />}
      <Tabs
        // A barra é própria porque duas coisas nela não cabem na do Expo Router: a primeira
        // célula é a FOTO do artista (não um ícone), e "Mais" abre um painel em vez de navegar.
        tabBar={() => (imersivo ? null : <BarraDeAbas artista={artista} id={String(id)} />)}
        screenOptions={{ headerShown: false }}
      >
        <Tabs.Screen name="index" />
        <Tabs.Screen name="plano" />
        <Tabs.Screen name="catalogo" />
        <Tabs.Screen name="agenda" />
        <Tabs.Screen name="diagnostico" />
        <Tabs.Screen name="equipe" />
        <Tabs.Screen name="perfil" />
        <Tabs.Screen name="marketing" />
        <Tabs.Screen name="nyta" />
      </Tabs>
    </View>
  );
}

const estilos = StyleSheet.create({
  casca: { flex: 1 },
});
