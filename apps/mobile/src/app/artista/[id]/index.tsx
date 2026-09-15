import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { Image, Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import Feather from '@expo/vector-icons/Feather';

import {
  COR, COR_PAINEL, CORES_DOS_LANCAMENTOS, CORES_DOS_NUMEROS, RAIO,
} from '@maestra/core/constants/design';
import { useArtistCapabilities } from '@maestra/core/hooks/useArtistCapabilities';
import { useJourneyState } from '@maestra/core/hooks/useJourneyState';
import { pilaresDoPainel, type DestinoDoPilar } from '@maestra/core/nucleo/pilaresDoPainel';

import { EmblemaNyta } from '@/casca/EmblemaNyta';
import { FolhaDaAvaliacao } from '@/casca/conta/FolhaDaAvaliacao';
import { CartaoDeInformacao } from '@/casca/painel/CartaoDeInformacao';
import { CartaoDePilar } from '@/casca/painel/CartaoDePilar';
import { useArtistaDaRota } from '@/nucleo/artista';
import { useSessao } from '@/nucleo/sessao';

// A home do artista, e a porta do método — a mesma do `Dashboard` da web
// (`src/pages/Dashboard/index.tsx`), na mesma ordem e com as mesmas fontes de dado.
//
// Ela abre com os TRÊS PILARES (onde estou, execução, para onde ir) porque Diagnóstico, Plano de
// Ação e Planejamento saíram da barra de abas: estes cartões são o único caminho até eles. O que
// vem depois é consulta, na ordem em que se consulta: a Nyta, os números, as músicas e o rodapé.
//
// O que saiu daqui: o herói da próxima tarefa (virou o cartão de Execução, que diz a mesma coisa),
// os dois cartões promo (um repetia o módulo Músicas, o outro virou a linha do cartão de
// Planejamento) e a lista do catálogo cadastrado (ela vive inteira no módulo Músicas, e aqui nem
// tocava: o player da web é global e não existe no app).
//
// O escuro continua: os três pilares e os quatro números são azul-noite sobre o fundo claro, e é
// esse contraste que separa o método e a medida do resto da página, que é branca.

const numero = (valor?: number | null) =>
  typeof valor === 'number' ? valor.toLocaleString('pt-BR') : '—';

export default function Inicio() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const artista = useArtistaDaRota(id);
  const jornada = useJourneyState(artista);
  const { viewPlanning, manageTasks } = useArtistCapabilities(artista);
  const { sessao } = useSessao();
  const [avaliando, setAvaliando] = useState(false);

  const conteudo = artista?.content ?? {};
  const spotify = conteudo.spotifyProfile;
  const chartmetric = conteudo.chartmetricProfile;
  const faixas = conteudo.spotifyCatalog?.tracks ?? [];
  const albuns = conteudo.spotifyCatalog?.albums ?? [];

  const pilares = pilaresDoPainel(artista, jornada, { viewPlanning, manageTasks });

  // Sem faixas indexadas, os álbuns servem: é melhor mostrar o que existe do que uma lista vazia.
  const lancamentos = (faixas.length ? faixas : albuns.map((a) => ({
    id: a.id, name: a.name, album: 'Spotify', album_image: a.image, spotify_url: a.spotify_url,
  }))).slice(0, 4);

  const numeros = [
    ['Ouvintes mensais', numero(chartmetric?.monthly_listeners),
      spotify?.popularity != null ? `${spotify.popularity}/100 popularidade` : 'Spotify'],
    // Seguidores vêm da Chartmetric, e não do `spotifyProfile`: desde fev/2026 a Web API do
    // Spotify em Dev Mode não devolve mais `followers`. O campo ficava nulo em quase todo
    // artista e o cartão exibia um traço mudo, que lê como "não tem seguidores".
    ['Seguidores', numero(chartmetric?.sp_followers ?? spotify?.followers), 'Spotify'],
    ['Músicas ativas', String(faixas.length), `${albuns.length} álbuns/singles`],
    ['Tarefas pendentes', String(jornada.tasksPending), `${jornada.tasksDone} concluídas`],
  ];

  const abrir = (rota: string) => router.push(`/artista/${id}/${rota}` as never);

  // O destino vem semântico do núcleo; a rota é desta superfície. A web tem a própria tabela, com
  // os caminhos dela (`/artists/:id/action-plan` lá, `/artista/[id]/plano` aqui).
  const irPara = (destino: DestinoDoPilar) => {
    if (destino === 'diagnostico') return abrir('diagnostico');
    if (destino === 'plano') return abrir('plano');
    if (destino === 'planejamento') return abrir('perfil');
    if (destino === 'wizard') return router.push({ pathname: '/wizard/[id]', params: { id: String(id) } });
    if (destino === 'refazerDiagnostico') {
      return router.push({ pathname: '/criar-artista', params: { refazer: String(id) } });
    }
    return router.push('/planos');
  };

  return (
    <View style={estilos.tela}>
      <ScrollView contentContainerStyle={estilos.conteudo}>
        {/* As três portas do método */}
        {pilares.map((pilar) => (
          <CartaoDePilar key={pilar.chave} pilar={pilar} aoTocar={() => irPara(pilar.destino)} />
        ))}

        {/* A consultora vem logo depois das três portas: quem não soube o que fazer com elas
            pergunta aqui, sem ter de sair da home */}
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

        {/* Os números, dois por linha */}
        <View style={estilos.grade}>
          {numeros.map(([rotulo, valor, apoio], i) => (
            <View key={rotulo} style={estilos.cartaoDeNumero}>
              <View style={estilos.cabecalhoDoNumero}>
                <View style={[estilos.bolinha, { backgroundColor: CORES_DOS_NUMEROS[i] }]} />
                <Text style={estilos.rotuloDoNumero}>{rotulo}</Text>
              </View>
              {/* Um artista grande tem oito dígitos de ouvintes (38.799.335), e em duas
                  colunas isso quebra em duas linhas dentro do cartão. Encolher a fonte só
                  quando não couber mantém o número inteiro e não mexe em nada quando cabe. */}
              <Text style={estilos.numero} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6}>
                {valor}
              </Text>
              <Text style={[estilos.apoioDoNumero, { color: CORES_DOS_NUMEROS[i] }]}>{apoio}</Text>

              {/* Os dois riscos cruzados do rodapé: na web são dois degradês diagonais, um na
                  cor cheia e outro a meia opacidade. Aqui são duas faixas giradas — o desenho é
                  o mesmo e não precisa de SVG. */}
              <View style={estilos.faisca}>
                <View style={[estilos.risco, estilos.riscoUm, { backgroundColor: CORES_DOS_NUMEROS[i] }]} />
                <View style={[estilos.risco, estilos.riscoDois, { backgroundColor: CORES_DOS_NUMEROS[i] }]} />
              </View>
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

        {/* O rodapé encerra a home com o que é da CONTA, não da carreira. Os três levam a algum
            lugar: antes eram dois cartões que não faziam nada e a pessoa tocava neles à espera. */}
        <CartaoDeInformacao
          icone="life-buoy"
          titulo="Suporte"
          texto="Conte com o time Maestra em cada etapa."
          aoTocar={() => router.push('/suporte')}
        />
        <CartaoDeInformacao
          icone="star"
          titulo="Avalie a Maestra"
          texto="Sua nota ajuda a decidir o que vem depois."
          aoTocar={() => setAvaliando(true)}
        />
        <CartaoDeInformacao
          icone="file-text"
          titulo="Termos de uso"
          texto="Como a Maestra trata seus dados e sua música."
          aoTocar={() => router.push('/legal/termos')}
        />
      </ScrollView>

      <FolhaDaAvaliacao
        aberta={avaliando}
        usuarioId={sessao?.user?.id}
        aoFechar={() => setAvaliando(false)}
      />
    </View>
  );
}

const estilos = StyleSheet.create({
  tela: { flex: 1, backgroundColor: COR.fundo },
  conteudo: { paddingHorizontal: 16, paddingTop: 22, paddingBottom: 122, gap: 14 },
  flex: { flex: 1, minWidth: 0 },

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
  faisca: { height: 25, marginTop: 8, overflow: 'hidden', justifyContent: 'center' },
  risco: { position: 'absolute', left: '-10%', width: '120%', height: 3 },
  riscoUm: { transform: [{ rotate: '-22deg' }] },
  riscoDois: { transform: [{ rotate: '20deg' }], opacity: 0.5 },

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

});
