import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BRAND, BRAND_ONYX } from '@maestra/core/constants/brand';
import { useAppSelector } from '@maestra/core/store/store';

// O diagnostico R·E·A·L, em leitura.
//
// Nada e calculado aqui: o `realIndex` ja veio gravado no perfil, produzido pelo mesmo motor
// que a web usa. Esta tela so o desenha — e por isso ela e o teste de paridade mais honesto que
// existe, com dado real em vez de cenario inventado.

const DIMENSOES = [
  { chave: 'r', letra: 'R', nome: 'Reach', o_que: 'alcance: ouvintes, seguidores e vídeo' },
  { chave: 'e', letra: 'E', nome: 'Economics', o_que: 'dinheiro que entra e estrutura' },
  { chave: 'a', letra: 'A', nome: 'Audience', o_que: 'engajamento e conversão de quem ouve' },
  { chave: 'l', letra: 'L', nome: 'Legitimacy', o_que: 'chancela: imprensa, prêmios, playlist' },
] as const;

export default function Perfil() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const artista = useAppSelector((s) => s.artists.items.find((a) => a.id === id));

  const real = artista?.content?.realIndex;
  const foto = artista?.content?.spotifyProfile?.image;
  // O corte vem do proprio indice; 70 e o valor da V3, mas quem manda e o dado.
  const corte = real?.cutLine?.r ?? 70;

  return (
    <SafeAreaView style={estilos.tela}>
      <Stack.Screen options={{ headerShown: false }} />
      <ScrollView contentContainerStyle={estilos.conteudo}>
        <Pressable onPress={() => router.back()} hitSlop={12} style={estilos.voltar}>
          <Text style={estilos.voltarTexto}>‹  Perfis</Text>
        </Pressable>

        <View style={estilos.topo}>
          {foto
            ? <Image source={{ uri: foto }} style={estilos.foto} />
            : <View style={[estilos.foto, estilos.fotoVazia]} />}
          <View style={estilos.flex}>
            <Text style={estilos.nome}>{artista?.name ?? 'Perfil'}</Text>
            {!!artista?.content?.identity?.genre && (
              <Text style={estilos.genero}>{artista.content.identity.genre}</Text>
            )}
          </View>
        </View>

        {!real?.profile ? (
          <View style={estilos.aviso}>
            <Text style={estilos.avisoTitulo}>Sem diagnóstico ainda</Text>
            <Text style={estilos.avisoTexto}>
              Este perfil ainda não passou pelo REAL. O diagnóstico é feito na web.
            </Text>
          </View>
        ) : (
          <>
            <View style={estilos.cartaoPerfil}>
              <Text style={estilos.rotulo}>Perfil REAL</Text>
              <Text style={estilos.perfilNome}>{real.profile.name}</Text>
              <Text style={estilos.perfilDescricao}>{real.profile.description}</Text>
            </View>

            <Text style={estilos.secao}>Boletim</Text>
            {DIMENSOES.map((d) => {
              const nota = real.boletim?.[d.chave] ?? 0;
              const acesa = !!real.pattern?.[d.chave];
              return (
                <View key={d.chave} style={estilos.dimensao}>
                  <View style={estilos.linhaTopo}>
                    <Text style={[estilos.letra, acesa ? estilos.acesa : estilos.apagada]}>
                      {d.letra}
                    </Text>
                    <View style={estilos.flex}>
                      <Text style={estilos.dimNome}>{d.nome}</Text>
                      <Text style={estilos.dimOQue}>{d.o_que}</Text>
                    </View>
                    <Text style={[estilos.nota, acesa ? estilos.acesa : estilos.notaApagada]}>
                      {nota}
                    </Text>
                  </View>

                  <View style={estilos.trilho}>
                    <View style={[estilos.barra, { width: `${Math.max(nota, 1)}%` },
                                  acesa ? estilos.barraAcesa : estilos.barraApagada]} />
                    {/* A linha de acender, no lugar exato: sem ela o numero nao diz se passou. */}
                    <View style={[estilos.corte, { left: `${corte}%` }]} />
                  </View>
                </View>
              );
            })}
            <Text style={estilos.rodape}>
              A marca vertical é a linha de {corte}: acima dela a dimensao acende.
            </Text>

            {!!real.profile.insights?.length && (
              <>
                <Text style={estilos.secao}>O que isso quer dizer</Text>
                {real.profile.insights.map((texto, i) => (
                  <View key={i} style={estilos.insight}>
                    <Text style={estilos.marcador}>•</Text>
                    <Text style={estilos.insightTexto}>{texto}</Text>
                  </View>
                ))}
              </>
            )}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const estilos = StyleSheet.create({
  tela: { flex: 1, backgroundColor: '#fff' },
  flex: { flex: 1 },
  conteudo: { padding: 24, paddingBottom: 48, gap: 14 },
  voltar: { paddingVertical: 4, alignSelf: 'flex-start' },
  voltarTexto: { fontSize: 16, color: BRAND, fontWeight: '600' },
  topo: { flexDirection: 'row', alignItems: 'center', gap: 14, marginTop: 4 },
  foto: { width: 64, height: 64, borderRadius: 32, backgroundColor: '#f3f4f6' },
  fotoVazia: {},
  nome: { fontSize: 26, fontWeight: '800', color: BRAND_ONYX, letterSpacing: -0.4 },
  genero: { fontSize: 14, color: '#9ca3af', marginTop: 2 },
  aviso: { borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 14, padding: 18, gap: 6, marginTop: 10 },
  avisoTitulo: { fontSize: 16, fontWeight: '700', color: BRAND_ONYX },
  avisoTexto: { fontSize: 14, color: '#6b7280', lineHeight: 20 },
  cartaoPerfil: { backgroundColor: '#faf7fe', borderRadius: 16, padding: 18, gap: 4, marginTop: 8 },
  rotulo: { fontSize: 11, letterSpacing: 1.4, textTransform: 'uppercase', color: BRAND, fontWeight: '700' },
  perfilNome: { fontSize: 22, fontWeight: '800', color: BRAND_ONYX },
  perfilDescricao: { fontSize: 14, color: '#4b5563', lineHeight: 21, marginTop: 2 },
  secao: { fontSize: 11, letterSpacing: 1.4, textTransform: 'uppercase', color: '#9ca3af', marginTop: 14, fontWeight: '700' },
  dimensao: { gap: 8 },
  linhaTopo: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  letra: { fontSize: 22, fontWeight: '800', width: 22 },
  acesa: { color: BRAND },
  apagada: { color: '#d1d5db' },
  dimNome: { fontSize: 15, fontWeight: '700', color: BRAND_ONYX },
  dimOQue: { fontSize: 12, color: '#9ca3af' },
  nota: { fontSize: 20, fontWeight: '800' },
  notaApagada: { color: '#9ca3af' },
  trilho: { height: 8, borderRadius: 4, backgroundColor: '#f3f4f6', overflow: 'hidden', position: 'relative' },
  barra: { height: 8, borderRadius: 4 },
  barraAcesa: { backgroundColor: BRAND },
  barraApagada: { backgroundColor: '#c7cdd6' },
  corte: { position: 'absolute', top: -2, width: 2, height: 12, backgroundColor: '#6b7280' },
  rodape: { fontSize: 12, color: '#9ca3af', marginTop: 2 },
  insight: { flexDirection: 'row', gap: 8 },
  marcador: { color: BRAND, fontSize: 15, lineHeight: 21 },
  insightTexto: { flex: 1, fontSize: 14, color: '#4b5563', lineHeight: 21 },
});
