import { useLocalSearchParams } from 'expo-router';
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import Feather from '@expo/vector-icons/Feather';

import { COR, RAIO, COR_DIAGNOSTICO } from '@maestra/core/constants/design';

import { useArtistaDaRota } from '@/nucleo/artista';

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
  const artista = useArtistaDaRota(id);

  const real = artista?.content?.realIndex;
  const foto = artista?.content?.spotifyProfile?.image;
  // O corte vem do proprio indice; 70 e o valor da V3, mas quem manda e o dado.
  const corte = real?.cutLine?.r ?? 70;


  return (
    <View style={estilos.tela}>
      <ScrollView contentContainerStyle={estilos.conteudo}>

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

        {/* A pergunta que a tela responde primeiro é "que artista é este". */}
        {!real?.profile ? (
          <View style={estilos.aviso}>
            <Text style={estilos.avisoTitulo}>Sem diagnóstico ainda</Text>
            <Text style={estilos.avisoTexto}>
              Este perfil ainda não passou pelo REAL. O diagnóstico é feito na web.
            </Text>
          </View>
        ) : (
          <View style={estilos.cartaoPerfil}>
            <Text style={estilos.rotulo}>Perfil REAL</Text>
            <Text style={estilos.perfilNome}>{real.profile.name}</Text>
            <Text style={estilos.perfilDescricao}>{real.profile.description}</Text>
          </View>
        )}


        {!!real?.profile && (
          <>
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
                    {/* A linha de acender, no lugar exato: sem ela o número não diz se passou. */}
                    <View style={[estilos.corte, { left: `${corte}%` }]} />
                  </View>
                </View>
              );
            })}
            <Text style={estilos.rodape}>
              A marca vertical é a linha de {corte}: acima dela a dimensão acende.
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
    </View>
  );
}

const estilos = StyleSheet.create({
  // A paleta e a do `DiagnosticReport` da web: cartoes brancos com contorno frio e sombra baixa,
  // o cartao do perfil num degrade claro, e a frase de cada dimensao puxada por uma barra a
  // esquerda na cor da propria dimensao. Ver `COR_DIAGNOSTICO`.
  tela: { flex: 1, backgroundColor: COR.fundo },
  flex: { flex: 1, minWidth: 0 },
  conteudo: { paddingHorizontal: 18, paddingTop: 18, paddingBottom: 122, gap: 14 },
  // O hero: avatar de 60px e o nome grande, separados do resto por um fio.
  topo: {
    flexDirection: 'row', alignItems: 'center', gap: 16,
    paddingBottom: 24, marginBottom: 14,
    borderBottomWidth: 1, borderBottomColor: COR_DIAGNOSTICO.contornoDoHero,
  },
  foto: { width: 60, height: 60, borderRadius: 30, backgroundColor: COR.divisoria },
  fotoVazia: {},
  nome: { fontSize: 22, fontWeight: '800', color: COR_DIAGNOSTICO.titulo, lineHeight: 26 },
  genero: { fontSize: 13, color: COR_DIAGNOSTICO.texto, marginTop: 6 },
  atalho: {
    flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 6,
    borderWidth: 1, borderColor: COR_DIAGNOSTICO.contorno, borderRadius: 14, padding: 16,
    backgroundColor: COR.superficie,
  },
  aviso: {
    borderWidth: 1, borderColor: COR_DIAGNOSTICO.contorno, borderRadius: 14,
    padding: 18, gap: 6, marginTop: 10, backgroundColor: COR.superficie,
  },
  avisoTitulo: { fontSize: 16, fontWeight: '700', color: COR_DIAGNOSTICO.titulo },
  avisoTexto: { fontSize: 14, color: COR_DIAGNOSTICO.texto, lineHeight: 20 },
  // O "momento uau": cartao com canto largo, degrade claro e sombra.
  cartaoPerfil: {
    borderRadius: 20, padding: 26, paddingHorizontal: 24, gap: 4, marginBottom: 14,
    borderWidth: 1, borderColor: COR_DIAGNOSTICO.contorno, backgroundColor: COR.superficie,
  },
  rotulo: {
    fontSize: 11, letterSpacing: 1.4, textTransform: 'uppercase',
    color: COR.primaria, fontWeight: '800',
  },
  perfilNome: { fontSize: 38, fontWeight: '800', color: COR_DIAGNOSTICO.titulo, lineHeight: 40, marginTop: 4 },
  perfilDescricao: { fontSize: 15, color: COR_DIAGNOSTICO.titulo, lineHeight: 22, marginTop: 14 },
  secao: {
    fontSize: 11, letterSpacing: 1.4, textTransform: 'uppercase',
    color: COR_DIAGNOSTICO.texto, marginTop: 14, fontWeight: '800',
  },
  // Cada dimensao e um cartao completo — nota, regua e o que ela revela.
  dimensao: {
    gap: 8, padding: 22, paddingHorizontal: 20, borderRadius: 14,
    borderWidth: 1, borderColor: COR_DIAGNOSTICO.contorno, backgroundColor: COR.superficie,
  },
  linhaTopo: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  letra: { fontSize: 22, fontWeight: '800', width: 22 },
  acesa: { color: COR.primaria },
  apagada: { color: COR.contorno },
  dimNome: { fontSize: 17, fontWeight: '800', color: COR_DIAGNOSTICO.titulo, lineHeight: 19 },
  dimOQue: { fontSize: 11.5, color: COR_DIAGNOSTICO.texto, marginTop: 2 },
  nota: { fontSize: 16, fontWeight: '800', color: COR_DIAGNOSTICO.titulo },
  notaApagada: { color: COR_DIAGNOSTICO.texto },
  trilho: { height: 8, borderRadius: 4, backgroundColor: COR.divisoria, overflow: 'hidden', position: 'relative' },
  barra: { height: 8, borderRadius: 4 },
  barraAcesa: { backgroundColor: COR.primaria },
  barraApagada: { backgroundColor: COR.apagado },
  corte: { position: 'absolute', top: -2, width: 2, height: 12, backgroundColor: COR_DIAGNOSTICO.texto },
  rodape: { fontSize: 11.5, color: COR_DIAGNOSTICO.texto, marginTop: 2 },
  // A frase puxada por uma barra a esquerda, como na web.
  insight: {
    flexDirection: 'row', gap: 13, marginTop: 16,
    borderLeftWidth: 2, borderLeftColor: COR.primaria, paddingLeft: 13,
  },
  marcador: { display: 'none' },
  insightTexto: { flex: 1, fontSize: 12.5, color: COR_DIAGNOSTICO.texto, lineHeight: 19 },
});
