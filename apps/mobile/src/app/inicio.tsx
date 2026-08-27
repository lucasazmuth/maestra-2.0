import { Redirect } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BRAND, BRAND_ONYX } from '@maestra/core/constants/brand';
import { computeRealIndexV3, type RealInputsV3 } from '@maestra/core/services/realEngine';
import { sair } from '@/nucleo/entrar';
import { useSessao } from '@/nucleo/sessao';

// A home do app, e por enquanto tambem a prova da Etapa 1.
//
// O que precisa ficar demonstrado nao e visual: e que o app roda a MESMA logica que a web,
// vinda de `@maestra/core`, sem copia e sem adaptacao. Os cenarios abaixo sao os mesmos que a
// suite do nucleo verifica — se o numero divergir, o Metro esta carregando outra coisa, e e
// melhor descobrir com uma tela do que com vinte prontas.

const entrada = (over: Partial<RealInputsV3> = {}): RealInputsV3 => ({
  spotifyConnected: true,
  spotifyListeners: 0, igFollowers: 0, tiktokFollowers: 0, youtubeMonthlyViews: 0,
  spotifyFollowers: 0, deezerFans: 0, igEngagement: 0, youtubeEngagement: 0, tiktokEngagement: 0,
  editorialPlaylists: 0, radioAirplay: null,
  showsPerMonth: 0, cache: 0, faturamentoForaShows: 0, revenueSources: {}, investimento: 0,
  temCnpj: false, temEmpresario: false,
  premios: 0, imprensaRepercussao: false, imprensaMatrix: [], imprensaFrequencia: 'lancamento',
  fazBilheteria: false, pagantePct: null,
  ...over,
});

const CENARIOS = [
  {
    nome: 'Artista sem Spotify',
    porque: 'o bug do piso por componente: dava 7 quando devia dar 0',
    criterio: 'exatamente 0',
    obtido: computeRealIndexV3(entrada({ spotifyConnected: false })).boletim.r,
    passa: (r: number) => r === 0,
  },
  {
    nome: '556 mil ouvintes, 24 mil seguidores',
    porque: 'quem esta encostado no corte nao pode empatar com quem nao tem nada',
    criterio: 'entre 41 e 69',
    obtido: computeRealIndexV3(entrada({
      spotifyListeners: 556_000, igFollowers: 24_000,
      tiktokFollowers: null, youtubeMonthlyViews: null,
    })).boletim.r,
    passa: (r: number) => r > 40 && r < 70,
  },
];

export default function Inicio() {
  const { sessao, carregando } = useSessao();

  if (!carregando && !sessao) return <Redirect href="/entrar" />;

  const tudoBate = CENARIOS.every((c) => c.passa(c.obtido));

  return (
    <SafeAreaView style={estilos.tela}>
      <ScrollView contentContainerStyle={estilos.conteudo}>
        <Text style={estilos.marca}>Maestra</Text>
        <Text style={estilos.legenda}>{sessao?.user.email}</Text>

        <Text style={estilos.secao}>O nucleo, rodando aqui dentro</Text>
        {CENARIOS.map((c) => (
          <View key={c.nome} style={estilos.cartao}>
            <Text style={estilos.titulo}>{c.nome}</Text>
            <Text style={estilos.porque}>{c.porque}</Text>
            <View style={estilos.linha}>
              <Text style={estilos.rotulo}>Reach</Text>
              <Text style={[estilos.valor, c.passa(c.obtido) ? estilos.ok : estilos.ruim]}>
                {c.obtido}/100
              </Text>
            </View>
            <Text style={estilos.esperado}>a suite exige: {c.criterio}</Text>
          </View>
        ))}
        <Text style={[estilos.veredito, tudoBate ? estilos.ok : estilos.ruim]}>
          {tudoBate ? 'Mesma logica do app e da web.' : 'Divergencia: investigar o Metro.'}
        </Text>

        <Pressable style={estilos.sair} onPress={sair}>
          <Text style={estilos.textoSair}>Sair da conta</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const estilos = StyleSheet.create({
  tela: { flex: 1, backgroundColor: '#fff' },
  conteudo: { padding: 24, gap: 14 },
  marca: { fontSize: 32, fontWeight: '800', color: BRAND_ONYX, letterSpacing: -0.5 },
  legenda: { fontSize: 14, color: '#6b7280', marginBottom: 10 },
  secao: { fontSize: 12, letterSpacing: 1.2, textTransform: 'uppercase', color: '#9ca3af' },
  cartao: { borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 14, padding: 16, gap: 6 },
  titulo: { fontSize: 17, fontWeight: '700', color: BRAND_ONYX },
  porque: { fontSize: 13, color: '#6b7280', lineHeight: 19 },
  linha: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', marginTop: 6 },
  rotulo: { fontSize: 13, textTransform: 'uppercase', letterSpacing: 1, color: '#9ca3af' },
  valor: { fontSize: 28, fontWeight: '800' },
  esperado: { fontSize: 12, color: '#9ca3af' },
  veredito: { fontSize: 15, fontWeight: '700' },
  ok: { color: BRAND },
  ruim: { color: '#b32d45' },
  sair: { marginTop: 20, height: 48, alignItems: 'center', justifyContent: 'center' },
  textoSair: { fontSize: 15, fontWeight: '600', color: '#6b7280' },
});
