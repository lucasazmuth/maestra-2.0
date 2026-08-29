import { useLocalSearchParams, useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useState } from 'react';
import { Image, Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import Feather from '@expo/vector-icons/Feather';

import {
  COR, COR_PAINEL, CORES_DOS_LANCAMENTOS, CORES_DOS_NUMEROS, RAIO,
} from '@maestra/core/constants/design';
import { TASK_TYPES } from '@maestra/core/constants/maestra';
import { useJourneyState } from '@maestra/core/hooks/useJourneyState';
import type { CatalogItem } from '@maestra/core/interfaces/maestra';
import { listCatalogProjectItems } from '@maestra/core/services/db/catalog';

import { EmblemaNyta } from '@/casca/EmblemaNyta';
import { useArtistaDaRota } from '@/nucleo/artista';

// A home do artista — a porta do `Dashboard` da web (`src/pages/Dashboard/index.tsx`), na mesma
// ordem e com as mesmas fontes de dado.
//
// É a única tela do produto com cartões ESCUROS: o hero da próxima tarefa e os quatro números
// são azul-noite sobre o fundo claro, e é esse contraste que separa "o que fazer agora" e "onde
// eu estou" do resto da página, que é branca.
//
// Duas ausências deliberadas em relação à web:
//
// · a `music-spark` — dois degradês diagonais cruzados no rodapé de cada cartão de número. É
//   decoração pura, não desenha dado nenhum, e sai caro em `react-native-svg` pra nada;
// · o player: tocar uma faixa da lista abre o projeto no catálogo em vez de tocar. O player da
//   web é global (mora no Layout) e ainda não existe aqui — botão de play que não toca seria
//   pior que não ter.

const numero = (valor?: number | null) =>
  typeof valor === 'number' ? valor.toLocaleString('pt-BR') : '—';

export default function Inicio() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const artista = useArtistaDaRota(id);
  const jornada = useJourneyState(artista);
  const [projetos, setProjetos] = useState<CatalogItem[]>([]);

  useEffect(() => {
    if (!artista?.id) return undefined;
    let vivo = true;
    listCatalogProjectItems(artista.id)
      .then((itens) => { if (vivo) setProjetos(itens); })
      .catch(() => { if (vivo) setProjetos([]); });
    return () => { vivo = false; };
  }, [artista?.id]);

  const conteudo = artista?.content ?? {};
  const spotify = conteudo.spotifyProfile;
  const chartmetric = conteudo.chartmetricProfile;
  const estrategias = conteudo.strategies ?? [];
  const faixas = conteudo.spotifyCatalog?.tracks ?? [];
  const albuns = conteudo.spotifyCatalog?.albums ?? [];

  const tarefas = estrategias.flatMap((e) =>
    (e.tasks ?? []).map((t) => ({ ...t, estrategia: e.title })));
  const pendentes = tarefas.filter((t) => t.status !== 'done' && t.status !== 'archived');
  const proxima = pendentes[0];
  // O chip do meio mostra a CATEGORIA da tarefa, não o título da estratégia — esse já aparece
  // inteiro na linha de cima. Sem categoria o chip simplesmente não entra.
  const categoria = proxima
    ? TASK_TYPES.find((t) => t.v === proxima.type)?.label ?? null
    : jornada.next.kicker;

  // Sem faixas indexadas, os álbuns servem: é melhor mostrar o que existe do que uma lista vazia.
  const lancamentos = (faixas.length ? faixas : albuns.map((a) => ({
    id: a.id, name: a.name, album: 'Spotify', album_image: a.image, spotify_url: a.spotify_url,
  }))).slice(0, 4);

  // A MESMA lista, ordem e colunas do módulo Músicas: só o catálogo cadastrado na plataforma.
  // Álbum publicado no Spotify e nunca cadastrado como projeto não entra aqui.
  const doCatalogo = projetos.slice(0, 5);

  const numeros = [
    ['Ouvintes mensais', numero(chartmetric?.monthly_listeners),
      spotify?.popularity != null ? `${spotify.popularity}/100 popularidade` : 'Spotify'],
    // Seguidores vêm da Chartmetric, e não do `spotifyProfile`: desde fev/2026 a Web API do
    // Spotify em Dev Mode não devolve mais `followers`. O campo ficava nulo em quase todo
    // artista e o cartão exibia um traço mudo, que lê como "não tem seguidores".
    ['Seguidores', numero(chartmetric?.sp_followers ?? spotify?.followers), 'Spotify'],
    ['Músicas ativas', String(faixas.length), `${albuns.length} álbuns/singles`],
    ['Tarefas pendentes', String(pendentes.length), `${jornada.tasksDone} concluídas`],
  ];

  const abrir = (rota: string) => router.push(`/artista/${id}/${rota}` as never);

  return (
    <View style={estilos.tela}>
      <ScrollView contentContainerStyle={estilos.conteudo}>
        {/* Hero da próxima tarefa */}
        <LinearGradient
          colors={[COR_PAINEL.heroDe, COR_PAINEL.heroAte]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={estilos.hero}
        >
          {/* O anel que a web desenha com `::after`: um círculo vazado, cortado pela borda. */}
          <View style={estilos.anel} pointerEvents="none" />

          <Text style={estilos.heroRotulo}>PRÓXIMA TAREFA DO PLANO</Text>
          <Text style={estilos.heroTitulo} numberOfLines={3}>
            {proxima?.description || jornada.next.title}
          </Text>
          <Text style={estilos.heroLegenda} numberOfLines={2}>
            {proxima?.estrategia || jornada.next.desc}
          </Text>

          <View style={estilos.pilulas}>
            <View style={[estilos.pilula, estilos.pilulaNumero]}>
              <Text style={estilos.pilulaTexto}>#01</Text>
            </View>
            {!!categoria && (
              <View style={estilos.pilula}>
                <Text style={estilos.pilulaTexto} numberOfLines={1}>{categoria}</Text>
              </View>
            )}
            <View style={estilos.pilula}>
              <Text style={[estilos.pilulaTexto, estilos.pilulaPrazo]}>
                {proxima?.deadline || 'Sem prazo definido'}
              </Text>
            </View>
          </View>

          <Pressable style={estilos.heroBotao} onPress={() => abrir('plano')} accessibilityRole="button">
            <Text style={estilos.heroBotaoTexto}>Ver Plano de Ação</Text>
          </Pressable>
        </LinearGradient>

        {/* Os números, dois por linha */}
        <View style={estilos.grade}>
          {numeros.map(([rotulo, valor, apoio], i) => (
            <View key={rotulo} style={estilos.cartaoDeNumero}>
              <View style={estilos.cabecalhoDoNumero}>
                <View style={[estilos.bolinha, { backgroundColor: CORES_DOS_NUMEROS[i] }]} />
                <Text style={estilos.rotuloDoNumero}>{rotulo}</Text>
              </View>
              <Text style={estilos.numero}>{valor}</Text>
              <Text style={[estilos.apoioDoNumero, { color: CORES_DOS_NUMEROS[i] }]}>{apoio}</Text>
            </View>
          ))}
        </View>

        {/* Músicas lançadas */}
        <View style={estilos.cartao}>
          <View style={estilos.cabecalhoDoCartao}>
            <Text style={estilos.tituloDoCartao}>Músicas lançadas</Text>
            <Pressable onPress={() => abrir('catalogo')} accessibilityRole="button">
              <Text style={estilos.acaoDoCartao}>Ver músicas →</Text>
            </Pressable>
          </View>
          {lancamentos.length === 0 ? (
            <View style={[estilos.lancamento, { backgroundColor: CORES_DOS_LANCAMENTOS[0] }]}>
              <View style={estilos.disco} />
              <View style={estilos.flex}>
                <Text style={estilos.lancamentoTitulo}>Sem músicas</Text>
                <Text style={estilos.lancamentoLegenda}>Conecte o Spotify ou adicione músicas</Text>
              </View>
            </View>
          ) : lancamentos.map((faixa, i) => (
            <Pressable
              key={faixa.id || faixa.name}
              style={[estilos.lancamento, { backgroundColor: CORES_DOS_LANCAMENTOS[i % 4] }]}
              // Mesmo destino do "Ouvir no Spotify" que o catálogo já usa. Sem `spotify_url`
              // (faixa que só teve o álbum indexado) o toque não faz nada — o cartão ainda diz
              // o que é, então desabilitar seria perder informação por nada.
              onPress={() => faixa.spotify_url && Linking.openURL(faixa.spotify_url)}
              accessibilityRole="button"
              accessibilityLabel={`${faixa.name}. Abrir no Spotify`}
            >
              {faixa.album_image
                ? <Image source={{ uri: faixa.album_image }} style={estilos.disco} />
                : <View style={estilos.disco} />}
              <View style={estilos.flex}>
                <Text style={estilos.lancamentoTitulo} numberOfLines={1}>{faixa.name}</Text>
                <Text style={estilos.lancamentoLegenda}>{faixa.album || 'Spotify'}</Text>
              </View>
              <Text style={estilos.seta}>›</Text>
            </Pressable>
          ))}
        </View>

        {/* Os dois cartões de convite */}
        <LinearGradient
          colors={[COR_PAINEL.promoDe, COR_PAINEL.promoAte]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={estilos.promo}
        >
          <Text style={estilos.promoRotulo}>MÚSICAS</Text>
          <Text style={estilos.promoTitulo}>Organize suas músicas, versões e créditos.</Text>
          <Pressable onPress={() => abrir('catalogo')} accessibilityRole="button">
            <Text style={estilos.promoAcao}>Abrir músicas →</Text>
          </Pressable>
        </LinearGradient>

        <View style={[estilos.promo, estilos.promoClara]}>
          <Text style={estilos.promoNumero}>
            {estrategias.length.toString().padStart(2, '0')}
          </Text>
          <Text style={estilos.promoLegenda}>Estratégias ativas{'\n'}para o ciclo atual</Text>
          <Pressable onPress={() => abrir('perfil')} accessibilityRole="button">
            <Text style={estilos.promoAcaoClara}>Ver planejamento →</Text>
          </Pressable>
        </View>

        {/* O catálogo cadastrado */}
        <View style={estilos.cartao}>
          <View style={estilos.cabecalhoDoCartao}>
            <Text style={estilos.tituloDoCartao}>Músicas</Text>
          </View>
          {doCatalogo.length === 0 ? (
            <Text style={estilos.vazio}>Nenhuma música cadastrada ainda.</Text>
          ) : doCatalogo.map((faixa) => (
            <Pressable
              key={faixa.id}
              style={estilos.faixa}
              onPress={() => abrir('catalogo')}
              accessibilityRole="button"
              accessibilityLabel={faixa.title}
            >
              <Feather name="music" size={16} color={COR_PAINEL.faixaLegenda} />
              <View style={estilos.flex}>
                <Text style={estilos.faixaTitulo} numberOfLines={1}>{faixa.title}</Text>
                <Text style={estilos.faixaLegenda}>V{faixa.version_number || 1}</Text>
              </View>
            </Pressable>
          ))}
          <Pressable style={estilos.botaoSuave} onPress={() => abrir('catalogo')} accessibilityRole="button">
            <Text style={estilos.botaoSuaveTexto}>Ver músicas</Text>
          </Pressable>
        </View>

        {/* A Nyta fecha o painel, depois de tudo que a pessoa veio consultar */}
        <Pressable
          style={estilos.cartaoDaNyta}
          onPress={() => abrir('nyta')}
          accessibilityRole="button"
          accessibilityLabel="Abrir a Nyta"
        >
          <View style={estilos.cabecalhoDaNyta}>
            <EmblemaNyta size={32} />
            <View style={estilos.flex}>
              <Text style={estilos.nomeDaNyta}>Nyta IA</Text>
              <Text style={estilos.papelDaNyta}>Estratégia de Carreira</Text>
            </View>
          </View>
          <Text style={estilos.tituloDaNyta}>Como posso te ajudar hoje?</Text>
          <Text style={estilos.legendaDaNyta}>
            Sua estrategista de carreira, todos os dias, pra você focar na sua música.
          </Text>
          <View style={estilos.campoDaNyta}>
            <Text style={estilos.campoDaNytaTexto} numberOfLines={1}>
              Quais análises da sua carreira vamos fazer hoje?
            </Text>
            <Feather name="arrow-right" size={18} color={COR.primaria} />
          </View>
        </Pressable>

        {/* Rodapé informativo */}
        {[
          ['shield', 'Dados seguros', 'Suas músicas e informações sempre protegidas.'],
          ['music', 'Novidades da indústria', 'Curadoria para apoiar decisões da carreira.'],
        ].map(([icone, titulo, texto]) => (
          <View key={titulo} style={estilos.rodape}>
            <Feather name={icone as 'shield'} size={22} color={COR_PAINEL.rodapeIcone} />
            <Text style={estilos.rodapeTitulo}>{titulo}</Text>
            <Text style={estilos.rodapeTexto}>{texto}</Text>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

const estilos = StyleSheet.create({
  tela: { flex: 1, backgroundColor: COR.fundo },
  conteudo: { paddingHorizontal: 16, paddingTop: 22, paddingBottom: 122, gap: 14 },
  flex: { flex: 1, minWidth: 0 },

  hero: { overflow: 'hidden', padding: 26, paddingBottom: 30, borderRadius: 14 },
  anel: {
    position: 'absolute',
    right: -74,
    bottom: -126,
    width: 190,
    height: 190,
    borderRadius: 95,
    borderWidth: 2,
    borderColor: COR.marca,
    opacity: 0.72,
  },
  heroRotulo: {
    marginBottom: 8, color: COR_PAINEL.heroRotulo, fontSize: 10, fontWeight: '800', letterSpacing: 1.1,
  },
  heroTitulo: { color: COR_PAINEL.sobreEscuro, fontSize: 34, lineHeight: 37, fontWeight: '800' },
  heroLegenda: { marginTop: 10, color: COR_PAINEL.heroTexto, fontSize: 12, lineHeight: 17 },
  pilulas: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 13 },
  pilula: {
    minHeight: 26,
    justifyContent: 'center',
    paddingHorizontal: 11,
    borderRadius: RAIO.pilula,
    borderWidth: 1,
    borderColor: COR_PAINEL.pilulaContorno,
    backgroundColor: COR_PAINEL.pilulaFundo,
  },
  pilulaNumero: { minWidth: 32, alignItems: 'center', paddingHorizontal: 0, backgroundColor: COR_PAINEL.pilulaNumero },
  pilulaTexto: { color: COR_PAINEL.pilulaTexto, fontSize: 10, fontWeight: '800' },
  pilulaPrazo: { color: COR_PAINEL.pilulaPrazo },
  heroBotao: {
    marginTop: 20,
    alignItems: 'center',
    paddingVertical: 15,
    paddingHorizontal: 18,
    borderRadius: 24,
    backgroundColor: COR.primaria,
  },
  heroBotaoTexto: { color: COR.sobrePrimaria, fontSize: 12, fontWeight: '800' },

  grade: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  cartaoDeNumero: {
    width: '48%',
    flexGrow: 1,
    minHeight: 154,
    padding: 18,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: COR_PAINEL.cartaoDeNumero,
  },
  cabecalhoDoNumero: { flexDirection: 'row', alignItems: 'flex-start', gap: 9 },
  bolinha: { width: 9, height: 9, marginTop: 4, borderRadius: 5 },
  rotuloDoNumero: { flex: 1, color: COR_PAINEL.rotuloDeNumero, fontSize: 12, fontWeight: '800', lineHeight: 15 },
  numero: { marginTop: 20, color: COR_PAINEL.sobreEscuro, fontSize: 32, fontWeight: '800', lineHeight: 37 },
  apoioDoNumero: { marginTop: 5, fontSize: 10, fontWeight: '700' },

  cartao: { overflow: 'hidden', borderRadius: 9, backgroundColor: COR.superficie },
  cabecalhoDoCartao: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 22,
    borderBottomWidth: 1,
    borderBottomColor: COR_PAINEL.linha,
  },
  tituloDoCartao: { color: COR_PAINEL.tituloDoCartao, fontSize: 14, fontWeight: '700' },
  acaoDoCartao: { color: COR_PAINEL.acaoDoCartao, fontSize: 10, fontWeight: '800' },

  lancamento: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 91, padding: 17 },
  disco: { width: 24, height: 24, borderRadius: 12, backgroundColor: COR_PAINEL.disco },
  lancamentoTitulo: { color: COR_PAINEL.sobreEscuro, fontSize: 11, fontWeight: '700' },
  lancamentoLegenda: { marginTop: 5, color: COR_PAINEL.velado, fontSize: 9, fontWeight: '700' },
  seta: { color: COR_PAINEL.seta, fontSize: 22 },

  promo: { minHeight: 180, padding: 23, borderRadius: 9 },
  promoClara: { backgroundColor: COR.superficie },
  promoRotulo: { color: COR_PAINEL.promoRotulo, fontSize: 10, fontWeight: '800', lineHeight: 16 },
  promoTitulo: {
    maxWidth: 180, marginTop: 15, color: COR_PAINEL.sobreEscuro, fontSize: 18, lineHeight: 22, fontWeight: '700',
  },
  promoAcao: { marginTop: 22, color: COR_PAINEL.sobreEscuro, fontSize: 10, fontWeight: '800' },
  promoNumero: { color: COR_PAINEL.promoNumeroRoxo, fontSize: 42, lineHeight: 42, fontWeight: '800' },
  promoLegenda: { marginTop: 13, color: COR_PAINEL.promoTexto, fontSize: 12, lineHeight: 17 },
  promoAcaoClara: { marginTop: 18, color: COR.primaria, fontSize: 10, fontWeight: '800' },

  faixa: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: COR_PAINEL.linha,
  },
  faixaTitulo: { color: COR_PAINEL.faixaTitulo, fontSize: 11, fontWeight: '700' },
  faixaLegenda: { marginTop: 4, color: COR_PAINEL.faixaLegenda, fontSize: 9 },
  vazio: { padding: 22, color: COR_PAINEL.faixaLegenda, fontSize: 12 },
  botaoSuave: {
    alignSelf: 'center',
    marginVertical: 16,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 20,
    backgroundColor: COR_PAINEL.botaoSuave,
  },
  botaoSuaveTexto: { color: COR.primaria, fontSize: 10, fontWeight: '800' },

  cartaoDaNyta: { padding: 22, borderRadius: 9, backgroundColor: COR.superficie, gap: 10 },
  cabecalhoDaNyta: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  nomeDaNyta: { color: COR.titulo, fontSize: 13, fontWeight: '800' },
  papelDaNyta: { marginTop: 2, color: COR_PAINEL.faixaLegenda, fontSize: 10, fontWeight: '700' },
  tituloDaNyta: { marginTop: 4, color: COR.titulo, fontSize: 20, fontWeight: '800' },
  legendaDaNyta: { color: COR_PAINEL.promoTexto, fontSize: 12, lineHeight: 17 },
  campoDaNyta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 4,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: RAIO.pilula,
    borderWidth: 1,
    borderColor: COR.contorno,
  },
  campoDaNytaTexto: { flex: 1, color: COR.espaçoReservado, fontSize: 12 },

  rodape: { minHeight: 142, padding: 22, borderRadius: 9, backgroundColor: COR.superficie },
  rodapeTitulo: { marginTop: 14, marginBottom: 7, color: COR_PAINEL.rodapeTitulo, fontSize: 13, fontWeight: '700' },
  rodapeTexto: { color: COR_PAINEL.rodapeTexto, fontSize: 11, lineHeight: 17 },
});
